output "api_endpoint" {
  description = "API Gateway base URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "recommend_endpoint" {
  description = "POST your mood to this URL"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/recommend"
}

output "youtube_search_endpoint" {
  description = "GET youtube search results from this URL"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/youtube-search"
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

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_task_definition" {
  value = aws_ecs_task_definition.youtube_prefetch.arn
}