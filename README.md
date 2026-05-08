# Sistema de Votación

Este es un sistema de votación simple que utiliza PHP y MySQL para registrar votos.

## Requisitos

- XAMPP instalado
- PHP 7.0 o superior
- MySQL 5.6 o superior

## Instalación

1. Asegúrate de que XAMPP esté instalado y funcionando
2. Coloca estos archivos en la carpeta `htdocs` de XAMPP
3. Abre phpMyAdmin (http://localhost/phpmyadmin)
4. Importa el archivo `database.sql` para crear la base de datos y la tabla
5. Accede al sistema a través de: http://localhost/votaciones_prueba2

## Características

- Validación de cédula única (una persona solo puede votar una vez)
- Interfaz amigable y responsiva
- Mensajes de confirmación y error
- Registro de fecha y hora del voto

## Estructura de archivos

- `config.php`: Configuración de la conexión a la base de datos
- `index.php`: Interfaz principal de votación
- `database.sql`: Script para crear la base de datos y tablas

## Seguridad

- Validación de entrada de datos
- Prevención de votos duplicados
- Sanitización de datos 