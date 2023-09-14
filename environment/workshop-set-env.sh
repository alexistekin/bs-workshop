#!/bin/bash

# Query AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

# Check if AWS_ACCOUNT_ID is not empty
if [ -n "$AWS_ACCOUNT_ID" ]; then
  # Create the .environment-ws.json file
  cat <<EOF > .environment-ws.json
{
  "AWS_ACCOUNT_ID": "$AWS_ACCOUNT_ID"
}
EOF
  echo "Created .environment-ws.json with AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
else
  echo "Failed to retrieve AWS account ID."
fi
