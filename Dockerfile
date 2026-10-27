# syntax=docker/dockerfile:1.6
FROM php:8.2-apache

# ---- PHP 扩展 ----
RUN apt-get update \
 && apt-get install -y --no-install-recommends libssl-dev \
 && docker-php-ext-install pdo pdo_mysql \
 && pecl install redis \
 && docker-php-ext-enable redis \
 && apt-get purge -y --auto-remove libssl-dev \
 && rm -rf /var/lib/apt/lists/* /tmp/pear

# ---- PHP 运行配置:日志走 stderr,错误不暴露给客户端 ----
RUN { \
      echo 'log_errors = On'; \
      echo 'error_log = /proc/self/fd/2'; \
      echo 'expose_php = Off'; \
      echo 'display_errors = Off'; \
      echo 'memory_limit = 128M'; \
      echo 'opcache.enable = 1'; \
    } > /usr/local/etc/php/conf.d/zz-app.ini

# ---- Apache 改 8080 + 非 root(兼容 K8s restricted PodSecurity) ----
RUN sed -i 's/^Listen 80$/Listen 8080/' /etc/apache2/ports.conf \
 && sed -i 's#<VirtualHost \*:80>#<VirtualHost *:8080>#' /etc/apache2/sites-available/000-default.conf \
 && mkdir -p /var/run/apache2 /var/lock/apache2 \
 && chown -R www-data:www-data /var/run/apache2 /var/lock/apache2 /var/www/html

# ---- 应用代码 ----
COPY --chown=www-data:www-data src/ /var/www/html/

USER www-data
CMD ["apache2-foreground"]
EXPOSE 8080