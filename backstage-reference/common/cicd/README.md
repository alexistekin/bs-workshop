# Reusable CICD Configurations

1. `.gitlab-ci-aws-base.yml` 
  * default job settings and tool installations
  * job to create CICD stages for an environment
2. `.gitlab-ci-aws-image-kaniko.yml`
  * container image build steps that utilize kaniko
3. `.gitlab-ci-aws-iac-ecs.yml`
  * IaC/CDK deployment for ECS apps
4. `.gitlab-ci-aws-iac-rds.yml`
  * IaC/CDK deployment for RDS resources
5. `.gitlab-ci-aws-dind-spring-boot.yml`
  * docker-in-docker container image build steps for java/maven/springboot apps
