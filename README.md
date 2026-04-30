# Safay System

Sistema de gestão de vendas e estoque para a loja Safay Roupas e Variedades.

## Objetivo
Projeto acadêmico com possibilidade de uso real no negócio da loja.

## Tecnologias planejadas
- Firebase Authentication
- Cloud Firestore
- Cloud Storage
- Cloud Functions
- Git/GitHub

## Modelagem do banco

users
categories
products
products/{productId}/variants/{variantId}

### Estrutura de products
- name
- description
- categoryName
- basePrice
- featured
- active

### Estrutura de variants
- sku
- color
- size
- price
- stock
- active