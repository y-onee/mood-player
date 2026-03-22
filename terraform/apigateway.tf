# The HTTP API
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "GET", "OPTIONS"]
    allow_headers = ["Content-Type"]
  }

  tags = {
    Project = var.project_name
  }
}

# ── Lambda integration ────────────────────────────────────────────────────────
resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.mood_player.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "recommend" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /recommend"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# ── Stage (auto deploys every change) ────────────────────────────────────────
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  tags = {
    Project = var.project_name
  }
}

# ── Allow API Gateway to invoke Lambda ───────────────────────────────────────
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mood_player.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
