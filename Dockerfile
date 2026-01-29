# Stage 1: Build frontend with Node.js
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY ./api/wwwroot/package*.json ./
RUN npm install
COPY ./api/wwwroot ./
RUN npm run build

# Stage 2: Build .NET application
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS dotnet-build
WORKDIR /App
COPY ./api ./
RUN dotnet restore
RUN dotnet publish -o out

# Stage 3: Final runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /App
COPY --from=dotnet-build /App/out ./
# Copy the built frontend (with compiled CSS) to wwwroot
COPY --from=frontend-build /frontend ./wwwroot
# COPY ./api/images ./images
ENTRYPOINT ["dotnet", "api.dll"]