#!/bin/bash
# Runs automatically when LocalStack starts
echo "Initializing LocalStack S3 buckets..."

awslocal s3 mb s3://anatoview-assets
awslocal s3 mb s3://anatoview-models

# Set public read for model assets
awslocal s3api put-bucket-policy \
  --bucket anatoview-assets \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::anatoview-assets/*"
    }]
  }'

echo "LocalStack S3 ready: http://localstack:4566/anatoview-assets"
