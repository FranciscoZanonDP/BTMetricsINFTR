#!/bin/bash

# Script de instalación para Bot de Métricas ITracker
# Este script automatiza la instalación y configuración del bot

set -e  # Salir si hay algún error

echo "🤖 Instalando Bot de Métricas ITracker..."
echo "=========================================="

# Verificar que Node.js esté instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instala Node.js 18+ primero."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versión $NODE_VERSION detectada. Se requiere Node.js 18+"
    exit 1
fi

echo "✅ Node.js $(node -v) detectado"

# Verificar que npm esté instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm no está instalado."
    exit 1
fi

echo "✅ npm $(npm -v) detectado"

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Error instalando dependencias"
    exit 1
fi

echo "✅ Dependencias instaladas"

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env..."
    cp env.example .env
    echo "✅ Archivo .env creado"
    echo "⚠️  IMPORTANTE: Edita el archivo .env con tus credenciales antes de ejecutar el bot"
else
    echo "✅ Archivo .env ya existe"
fi

# Crear directorio de logs
echo "📁 Creando directorio de logs..."
mkdir -p logs
echo "✅ Directorio de logs creado"

# Compilar TypeScript
echo "🔨 Compilando TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error compilando TypeScript"
    exit 1
fi

echo "✅ TypeScript compilado"

# Verificar configuración
echo "🔍 Verificando configuración..."

# Verificar variables de entorno críticas
if [ ! -f .env ]; then
    echo "❌ Archivo .env no encontrado"
    exit 1
fi

# Cargar variables de entorno para verificación
source .env 2>/dev/null || true

if [ -z "$SUPABASE_URL" ]; then
    echo "⚠️  SUPABASE_URL no configurado en .env"
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "⚠️  SUPABASE_SERVICE_KEY no configurado en .env"
fi

if [ -z "$API_BASE_URL" ]; then
    echo "⚠️  API_BASE_URL no configurado en .env"
fi

echo "✅ Verificación completada"

echo ""
echo "🎉 Instalación completada exitosamente!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Edita el archivo .env con tus credenciales"
echo "2. Ejecuta 'npm start' para iniciar el bot"
echo "3. Ejecuta 'npm run dev -- --once' para una prueba"
echo ""
echo "📚 Para más información, consulta el README.md"
echo "" 