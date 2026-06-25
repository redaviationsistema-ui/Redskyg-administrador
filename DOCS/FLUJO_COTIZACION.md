# Flujo de Cálculo de Cotización de Vuelo

## Descripción

Este documento describe el proceso completo utilizado por el sistema para calcular una cotización de vuelo, desde la selección de la aeronave hasta la obtención del total en USD y MXN.

---

## Flujo General

### 1. Selección de Aeronave
- Obtener la aeronave seleccionada.
- Obtener la tarifa por hora.
- Obtener velocidad crucero.
- Obtener base de operación.
- Obtener horas mínimas.
- Obtener costo de pernocta.

---

### 2. Procesamiento de Rutas

Para cada tramo:

- Origen
- Destino
- Pasajeros

Buscar ambos aeropuertos y obtener sus coordenadas.

---

### 3. Cálculo de Distancia

Calcular la distancia entre ambos aeropuertos en Millas Náuticas (NM).

---

### 4. Tiempo Base

Tiempo Base = Distancia / Velocidad Crucero

---

### 5. Block Time

Aplicar factor operativo.

Nacional

Distancia × 1.12

Internacional

Distancia × 1.15

---

### 6. Buffer Operativo

Agregar tiempo adicional.

| Distancia | Buffer |
|-----------|---------|
| <300 NM | 0.25 h |
| <600 NM | 0.35 h |
| <1000 NM | 0.45 h |
| >=1000 NM | 0.50 h |

---

### 7. Redondeo

Redondear el tiempo al siguiente cuarto de hora.

Ejemplo:

2.31 → 2.50

---

### 8. Horas Mínimas

Si:

Horas Mínimas > Tiempo Calculado

Entonces:

Horas Cobrables = Horas Mínimas

---

### 9. Costo del Tramo

Costo = Horas Cobrables × Tarifa por Hora

---

### 10. Reposicionamiento

Si la aeronave no se encuentra en el aeropuerto de salida:

Agregar vuelo de reposicionamiento.

---

### 11. Regreso a Base

Si la aeronave termina fuera de su base:

Agregar vuelo de regreso.

---

### 12. Cotización Complete

Agregar:

- Pernocta
- Gastos Operativos

---

### 13. Pernocta

Costo = Noches × Tarifa Pernocta

Si no existe tarifa configurada:

Tarifa Pernocta = Tarifa Hora × 50%

---

### 14. Subtotal

Subtotal =

Vuelo Cliente

+ Reposicionamiento

+ Regreso Base

+ Pernocta

+ Gastos Operativos

---

### 15. Impuestos

Air Only

0%

Internacional

4%

Nacional

16%

---

### 16. Total USD

Total USD =

Subtotal + Impuestos

---

### 17. Conversión

Total MXN =

Total USD × Tipo de Cambio