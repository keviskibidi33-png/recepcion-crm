from excel_logic import ExcelLogic
from models import RecepcionMuestra, MuestraConcreto
from datetime import datetime

def run():
    template_path = "templates/recepcion_template.xlsx"
    logic = ExcelLogic(template_path)
    
    muestras = []
    for i in range(1, 26):
        muestras.append(MuestraConcreto(
            item_numero=i,
            codigo_muestra=f"M-{i}",
            codigo_muestra_lem=f"LEM-{100+i}",
            identificacion_muestra=f"ID-{i}",
            estructura="COLUMNAS",
            fc_kg_cm2=210,
            fecha_moldeo="01/01/2026",
            hora_moldeo="08:00",
            edad=7,
            fecha_rotura="08/01/2026",
            requiere_densidad=True
        ))
    
    recepcion = RecepcionMuestra(
        numero_recepcion="SURGICAL-001",
        numero_cotizacion="COT-123",
        numero_ot="OT-999",
        cliente="TOTAL QUALITY CORP",
        domicilio_legal="AV. SURGICAL 123",
        ruc="20555555555",
        persona_contacto="ING. MARIO BENAVENTE",
        email="mario@totalquality.com",
        telefono="999-111-222",
        solicitante="CONSTRUCTORA ALPHA S.A.",
        domicilio_solicitante="CALLE LAS MAGNOLIAS 456",
        proyecto="PROJECT ALPHA",
        ubicacion="MAGDALENA, LIMA",
        fecha_recepcion=datetime(2026, 2, 5),
        fecha_estimada_culminacion="15/02/2026",
        emision_fisica=True,
        emision_digital=True,
        entregado_por="JUAN PEREZ",
        recibido_por="TECNICO LEM",
        observaciones="CILINDROS RECIBIDOS EN BUEN ESTADO.",
        muestras=muestras
    )
    
    data = logic.generar_excel_recepcion(recepcion)
    output_path = f"backend/SURGICAL_VALIDATION_FINAL_V6.xlsx"
    with open(output_path, 'wb') as f:
        f.write(data)
    print(f"Generated {output_path}")

if __name__ == "__main__":
    run()
