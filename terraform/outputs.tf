output "api_endpoint" {
  description = "API Gateway base URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "recommend_endpoint" {
  description = "POST your mood to this URL"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/recommend"
}

output "cloudfront_url" {
  description = "Your frontend URL"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "s3_bucket_name" {
  description = "S3 bucket name for uploading your frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.songs.name
}

output "radio_instance_id" {
  value = aws_instance.radio_server.id
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_task_definition" {
  value = aws_ecs_task_definition.youtube_prefetch.arn
}

output "public_subnet_id" {
  value = aws_subnet.main.id
}

output "fargate_sg_id" {
  value = aws_security_group.fargate_sg.id
}

output "radio_ecr_url" {
  value = aws_ecr_repository.radio_app.repository_url
}

output "radio_server_public_dns" {
  value = aws_instance.radio_server.public_dns
}

output "radio_websocket_url" {
  value = "wss://${aws_cloudfront_distribution.frontend.domain_name}/radio"
}
