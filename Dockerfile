FROM ubuntu
RUN apt-get update && \
    apt-get install -y \
            python3 \
            python3-pip \
            redis-server
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY . /game
WORKDIR /game
RUN pip3 install -r requirements.txt
EXPOSE 8000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["runserver", "0.0.0.0:8000"]
