# ── ECS Cluster ───────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  tags = {
    Project = var.project_name
  }
}

# ── IAM Role for ECS Task ─────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "${var.project_name}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDB"
        Effect = "Allow"
        Action = [
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
        ]
        Resource = aws_dynamodb_table.songs.arn
      },
      {
        Sid    = "ECR"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
        ]
        Resource = "*"
      },
      {
        Sid    = "Logs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# ── VPC & Networking ──────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name    = "${var.project_name}-vpc"
    Project = var.project_name
  }
}

resource "aws_subnet" "main" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true

  tags = {
    Name    = "${var.project_name}-subnet"
    Project = var.project_name
  }
}

resource "aws_subnet" "secondary" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1b"
  map_public_ip_on_launch = true

  tags = {
    Name    = "${var.project_name}-subnet-2"
    Project = var.project_name
  }
}

resource "aws_route_table_association" "secondary" {
  subnet_id      = aws_subnet.secondary.id
  route_table_id = aws_route_table.main.id
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name    = "${var.project_name}-igw"
    Project = var.project_name
  }
}

resource "aws_route_table" "main" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name    = "${var.project_name}-rt"
    Project = var.project_name
  }
}

resource "aws_route_table_association" "main" {
  subnet_id      = aws_subnet.main.id
  route_table_id = aws_route_table.main.id
}

resource "aws_security_group" "fargate_sg" {
  name        = "${var.project_name}-fargate-sg"
  description = "Allow radio traffic from the load balancer to Fargate"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description     = "Radio traffic from ALB"
    from_port       = 8765
    to_port         = 8765
    protocol        = "tcp"
    security_groups = [aws_security_group.radio_alb_sg.id]
  }

  tags = {
    Project = var.project_name
  }
}

resource "aws_security_group" "radio_alb_sg" {
  name        = "${var.project_name}-radio-alb-sg"
  description = "Allow inbound HTTP traffic to the radio load balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Project = var.project_name
  }
}

# ── CloudWatch Log Group for ECS ──────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = "/ecs/${var.project_name}-flask"
  retention_in_days = 14

  tags = {
    Project = var.project_name
  }
}

# ── Task Definition ───────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "youtube_prefetch" {
  family                   = "${var.project_name}-prefetch"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name      = "youtube-prefetch"
    image     = "${aws_ecr_repository.flask_app.repository_url}:latest"
    essential = true

    environment = [
      {
        name  = "DYNAMODB_TABLE"
        value = aws_dynamodb_table.songs.name
      },
      {
        name  = "YOUTUBE_API_KEY"
        value = var.youtube_api_key
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project_name}-flask"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

# ── CloudWatch Log Group for Radio ───────────────────────────────────────────
resource "aws_cloudwatch_log_group" "radio_logs" {
  name              = "/ecs/${var.project_name}-radio"
  retention_in_days = 14

  tags = {
    Project = var.project_name
  }
}

# ── Radio Task Definition ─────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "radio" {
  family                   = "${var.project_name}-radio"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name      = "radio-server"
    image     = "${aws_ecr_repository.radio_app.repository_url}:latest"
    essential = true

    portMappings = [{
      containerPort = 8765
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project_name}-radio"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_lb" "radio" {
  name               = "${var.project_name}-radio-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.radio_alb_sg.id]
  subnets            = [aws_subnet.main.id, aws_subnet.secondary.id]

  tags = {
    Project = var.project_name
  }
}

resource "aws_lb_target_group" "radio" {
  name        = "${var.project_name}-radio-tg"
  port        = 8765
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
    timeout             = 5
  }

  tags = {
    Project = var.project_name
  }
}

resource "aws_lb_listener" "radio_http" {
  load_balancer_arn = aws_lb.radio.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.radio.arn
  }
}

# ── Radio ECS Service (persistent) ───────────────────────────────────────────
resource "aws_ecs_service" "radio" {
  name                              = "${var.project_name}-radio-service"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.radio.arn
  desired_count                     = 1
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = [aws_subnet.main.id, aws_subnet.secondary.id]
    security_groups  = [aws_security_group.fargate_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.radio.arn
    container_name   = "radio-server"
    container_port   = 8765
  }

  depends_on = [aws_lb_listener.radio_http]

  tags = {
    Project = var.project_name
  }
}
