# Zips your handler.py into a deployment package
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "mood_player" {
  function_name    = var.project_name
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "python3.12"
  handler          = "handler.handler"
  role             = aws_iam_role.lambda_role.arn
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      DYNAMODB_TABLE   = aws_dynamodb_table.songs.name
      BEDROCK_MODEL_ID = var.bedrock_model_id
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda_logs]

  tags = {
    Project = var.project_name
  }
}
