FROM node:20-alpine3.18

RUN addgroup app && adduser -S -G app app

USER app

WORKDIR /app

COPY package*.json ./

# change ownership of the /app directory to the app user
USER root

RUN chown -R app:app .

USER app

RUN npm install

COPY . . 

EXPOSE 3000 

CMD npm run start