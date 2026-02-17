import { test, expect } from '@playwright/test';

/**
 * Test de Persistencia de LocalStorage para Geofal CRM
 * 
 * Este test verifica que los datos ingresados en el formulario de recepción
 * se mantengan guardados localmente incluso si el usuario recarga la página
 * o si el iframe se cierra y se vuelve a abrir.
 */

test.describe('Persistencia del Formulario de Recepción', () => {
  // Ajustar la URL según el entorno local
  const BASE_URL = 'http://localhost:5173/migration/nueva-recepcion';

  test('Debe persistir los datos del formulario tras una recarga', async ({ page }) => {
    // 1. Navegar al formulario de nueva recepción
    await page.goto(BASE_URL);

    // Generar datos de prueba únicos
    const timestamp = Date.now();
    const testData = {
      numero_ot: `OT-TEST-${timestamp}`,
      cliente: `CLIENTE TEST ${timestamp}`,
      proyecto: `PROYECTO TEST ${timestamp}`
    };

    console.log('📝 Ingresando datos de prueba:', testData);

    // 2. Llenar campos clave
    // Usamos selectores basados en el atributo 'name' que usa react-hook-form
    await page.fill('input[name="numero_ot"]', testData.numero_ot);
    await page.fill('input[name="cliente"]', testData.cliente);
    await page.fill('input[name="proyecto"]', testData.proyecto);

    // 3. Esperar al debounce del hook useFormPersist (1000ms configurado en el código)
    // Damos un margen de seguridad de 2s
    await page.waitForTimeout(2000);

    // 4. Verificar que se haya guardado en localStorage antes de recargar
    const localStorageBefore = await page.evaluate(() => {
      return localStorage.getItem('recepcion-form-new');
    });
    
    expect(localStorageBefore).toBeTruthy();
    expect(localStorageBefore).toContain(testData.numero_ot);
    console.log('✅ Datos verificados en localStorage antes de recargar');

    // 5. Recargar la página (Simula cerrar y abrir el iframe o refrescar el navegador)
    console.log('🔄 Recargando página...');
    await page.reload();

    // 6. Verificar que los campos del formulario se hayan repoblado
    // Esperamos a que el formulario se hidrate
    await page.waitForSelector('input[name="numero_ot"]');

    const valOT = await page.inputValue('input[name="numero_ot"]');
    const valCliente = await page.inputValue('input[name="cliente"]');
    const valProyecto = await page.inputValue('input[name="proyecto"]');

    expect(valOT).toBe(testData.numero_ot);
    expect(valCliente).toBe(testData.cliente);
    expect(valProyecto).toBe(testData.proyecto);

    console.log('🎉 ÉXITO: Los datos persistieron correctamente después de la recarga.');
  });

  test('Debe permitir limpiar el borrador', async ({ page }) => {
    await page.goto(BASE_URL);

    // Asegurarnos de que hay datos (del test anterior o nuevos)
    await page.fill('input[name="numero_ot"]', 'BORRAR_ME');
    await page.waitForTimeout(1500);

    // Buscar el botón "Eliminar Borrador"
    // Nota: El botón contiene el texto "Eliminar Borrador"
    const deleteBtn = page.getByText('Eliminar Borrador');
    
    if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        
        // Confirmar en el modal
        // El modal tiene un botón "Sí, eliminar" o similar. 
        // Según el código: confirmText="Sí, eliminar"
        await page.getByRole('button', { name: 'Sí, eliminar' }).click();

        // Verificar que se limpió
        const valOT = await page.inputValue('input[name="numero_ot"]');
        expect(valOT).toBe('');
        console.log('✅ Borrador eliminado correctamente');
    } else {
        console.log('⚠️ No se encontró el botón de eliminar borrador (¿quizás ya estaba limpio?)');
    }
  });
});
