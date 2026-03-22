resource "aws_dynamodb_table" "songs" {
  name         = "${var.project_name}-songs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "song_id"

  attribute {
    name = "song_id"
    type = "S"
  }

  tags = {
    Project = var.project_name
  }
}
