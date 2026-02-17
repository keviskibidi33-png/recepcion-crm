# Tests de Verificación - Recepción CRM

Este directorio contiene pruebas automatizadas para verificar la robustez del módulo de recepción.

## Requisitos Previos

Necesitas tener Node.js instalado.
Para ejecutar los tests, necesitas instalar Playwright:

```bash
npm install -D @playwright/test
npx playwright install
```

## Ejecutar el Test de Persistencia

Este test verifica que los datos del formulario no se pierdan al recargar la página o cerrar el iframe.

```bash
npx playwright test tests/verify-persistence.spec.ts --headed
```

## Verificación Manual

Si no deseas instalar herramientas de testing, puedes verificar la persistencia manualmente:

1. Abre la consola del navegador (F12).
2. Escribe datos en el formulario de "Nueva Recepción".
3. Observa los logs en la consola: `[FormPersist] Saving data for key: ...`
4. Recarga la página.
5. Observa el log: `[FormPersist] Loading saved data for key: ...`
6. Verifica que los campos se han llenado automáticamente.
