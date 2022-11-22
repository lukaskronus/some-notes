FROM ubuntu:latest

RUN apt update -y
RUN apt install wget -y
RUN apt install curl -y
RUN apt install jq -y

WORKDIR /root/files

COPY bash/cfgateway.sh /root/files

CMD bash cfgateway.sh