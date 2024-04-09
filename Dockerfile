FROM node:20.10.0 AS deps
WORKDIR /app

COPY .yarn ./.yarn
COPY package.json .yarnrc.yml yarn.lock*  ./
RUN yarn install --immutable

FROM node:20.10.0 AS runner
WORKDIR /app

COPY --from=deps /app/.yarn ./.yarn
COPY --from=deps /app/node_modules ./node_modules
COPY . .

CMD ["yarn", "start"]
