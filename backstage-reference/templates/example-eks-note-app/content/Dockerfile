# Use an existing node image as base image
FROM node:14-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY ./src/app/package*.json ./

# Install required packages
RUN npm install

# Copy all files to the container
COPY . .

# Expose port 3003
EXPOSE 3003

WORKDIR ./src/app
RUN pwd && ls

# Start the application
CMD [ "npm", "start" ]
