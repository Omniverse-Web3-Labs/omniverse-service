# build image for production environment
FROM node:18-alpine

RUN apk add --no-cache python3 make g++

# set working directory
WORKDIR /app

COPY package*.json ./

RUN npm install -only=production

# copy js code
COPY faucet ./faucet

COPY utils ./utils

# launch command
CMD ["node", "faucet/app.js"]
