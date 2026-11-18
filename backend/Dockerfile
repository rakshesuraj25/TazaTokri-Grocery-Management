# Stage 1: Build Spring Boot Backend JAR
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

COPY src/ src/
RUN ./mvnw package -DskipTests -B

# Stage 2: Hardened Non-Root JRE Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S -g 1001 tazatokri && adduser -S -u 1001 -G tazatokri tazatokri \
    && mkdir -p /app/data/private-uploads /app/data/backups \
    && chown -R tazatokri:tazatokri /app

COPY --from=build --chown=tazatokri:tazatokri /workspace/target/*.jar /app/app.jar

USER tazatokri
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health/liveness || exit 1

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
