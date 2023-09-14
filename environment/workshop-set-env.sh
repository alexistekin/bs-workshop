#!/bin/bash

# Get the current working directory
CURRENT_DIR=$(pwd)

# Set the subdirectory path
SUBDIRECTORY="environment"

# Construct the full directory path
DIR_PATH="$CURRENT_DIR/$SUBDIRECTORY"

# Query AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

# Check if AWS_ACCOUNT_ID is not empty
if [ -n "$AWS_ACCOUNT_ID" ]; then
  # Create the directory if it doesn't exist
  mkdir -p "$DIR_PATH"

  # Create the .environment-ws.json file in the specified directory
  cat <<EOF > "$DIR_PATH/.environment-ws.json"
{
  "AWS_ACCOUNT_ID": "$AWS_ACCOUNT_ID"
}
EOF
  echo "Created $DIR_PATH/.environment-ws.json with AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
else
  echo "Failed to retrieve AWS account ID"
fi
