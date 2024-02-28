FROM node:20.10.0

WORKDIR /app

COPY package.json ./
RUN yarn set version berry

# Install dependencies
COPY yarn.lock .yarn .yarnrc.yml ./
RUN yarn install

COPY . .

CMD ["yarn", "start"]
