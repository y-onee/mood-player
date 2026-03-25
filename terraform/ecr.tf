resource "aws_ecr_repository" "flask_app" {
  name                 = "${var.project_name}-flask"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  tags = {
    Project = var.project_name
  }
}

output "ecr_repository_url" {
  value = aws_ecr_repository.flask_app.repository_url
}

resource "aws_ecr_repository" "radio_app" {
  name                 = "${var.project_name}-radio"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  tags = {
    Project = var.project_name
  }
}

output "radio_ecr_repository_url" {
  value = aws_ecr_repository.radio_app.repository_url
}