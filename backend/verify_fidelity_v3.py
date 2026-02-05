from excel_logic import ExcelLogic
from models import RecepcionMuestra, MuestraConcreto
from datetime import datetime
import os

def test_fidelity():
    template_path = 'c:/Users/Lenovo/Documents/crmnew/recepcion-crm/templates/recepcion_template.xlsx'
    logic = ExcelLogic(template_path)
    
    # Mock Data
    muestras = []
    for i in range(1, 25): # 24 samples to test row shifting (threshold is 18)
        m = MuestraConcreto(
            item_numero=i,
            codigo_muestra_lem=f"LEM-{1000+i}",
            identificacion_muestra=f"CLI-SAMPLE-{i}",
            estructura=f"ZAPATA Z-{i}",
            fc_kg_cm2=280.0,
            fecha_moldeo="01/02/2026",
            hora_moldeo="10:00",
            edad=28,
            fecha_rotura="01/03/2026",
            requiere_densidad=True if i % 2 == 0 else False
        )
        muestras.append(m)
    
    recepcion = RecepcionMuestra(
        numero_recepcion="TEST-FIDELITY-001",
        numero_ot="OT-2026-001",
        numero_cotizacion="COT-999",
        cliente="CLIENTE DE PRUEBA S.A.",
        domicilio_legal="AV. TEST 123",
        ruc="20123456789",
        persona_contacto="JUAN PEREZ",
        email="juan@test.com",
        telefono="999888777",
        solicitante="SOLICITANTE TEST",
        domicilio_solicitante="AV. SOLICITANTE 456",
        proyecto="PROYECTO FIDELIDAD EXCEL",
        ubicacion="LIMA, PERU",
        fecha_recepcion=datetime.now(),
        emision_fisica=True,
        emision_digital=True,
        entregado_por="ENTREGADOR TEST",
        recibido_por="RECIBIDOR TEST",
        observaciones="ESTA ES UNA PRUEBA DE FIDELIDAD CON 24 MUESTRAS. DEBE DESPLAZAR EL FINAL."
    )
    recepcion.muestras = muestras
    
    # Generate
    try:
        output_data = logic.generar_excel_recepcion(recepcion)
        output_path = 'backend/FIDELITY_TEST_RESULT.xlsx'
        with open(output_path, 'wb') as f:
            f.write(output_data)
        print(f"SUCCESS: Result saved to {output_path}")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_fidelity()
