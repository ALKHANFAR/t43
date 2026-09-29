FROM nginx:alpine
# GATEWAY_URL = عنوان بوابة سيادة (مثل https://gateway.example.com) — envsubst يولّد default.conf عند التشغيل
ENV GATEWAY_URL=http://127.0.0.1:9
ENV NGINX_ENVSUBST_FILTER=^GATEWAY_URL$
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html
