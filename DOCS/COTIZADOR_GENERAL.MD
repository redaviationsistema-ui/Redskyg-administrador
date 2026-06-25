/**
 * ============================================================================
 * FLUJO DE CÁLCULO DE COTIZACIÓN
 * ============================================================================
 *
 * Este método calcula el costo completo de una cotización aérea.
 *
 * Flujo:
 *
 * 1. Obtener aeronave.
 * 2. Obtener tarifa por hora.
 * 3. Calcular distancia entre aeropuertos.
 * 4. Calcular tiempo base.
 * 5. Aplicar Block Time.
 * 6. Agregar buffer operativo.
 * 7. Redondear a cuartos de hora.
 * 8. Validar horas mínimas.
 * 9. Calcular costo del tramo.
 * 10. Agregar reposicionamiento si aplica.
 * 11. Agregar regreso a base si aplica.
 * 12. Agregar pernocta y gastos operativos.
 * 13. Calcular subtotal.
 * 14. Aplicar impuestos.
 * 15. Obtener Total USD.
 * 16. Convertir a MXN.
 *
 * Resultado:
 * Retorna el detalle completo de la cotización listo para persistirse
 * y mostrarse en la interfaz.
 * ============================================================================
 */