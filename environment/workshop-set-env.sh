#!/bin/bash

#script to simplify Workshop environment variable setup 

USE_DEFAULT="n"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
VAR_STORE="1"
USER="ec2-user"

#create environment
make ce <<EOF
$USE_DEFAULT
$AWS_ACCOUNT_ID
$VAR_STORE
$USER
EOF

#update environment and store lookup variables
make pce
DR=y make pce
