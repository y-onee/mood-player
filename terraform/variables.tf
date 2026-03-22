variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "youtube_api_key" {
  description = "YouTube Data API v3 key"
  type        = string
  sensitive   = true
}

variable "bedrock_model_id" {
  description = "Amazon Bedrock model ID"
  type        = string
  default     = "amazon.nova-lite-v1:0"
}

variable "project_name" {
  description = "Project name used for naming all resources"
  type        = string
  default     = "mood-player"
}
