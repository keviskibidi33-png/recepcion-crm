from excel_logic import ExcelLogic
from models import RecepcionMuestra, MuestraConcreto
from datetime import datetime

class MockRecepcion:
    def __init__(self):
        self.numero_recepcion = "PROBE-REC"
        self.numero_cotizacion = "PROBE-COT"
        self.fecha_recepcion = datetime.now()
        self.numero_ot = "PROBE-OT"
        self.cliente = "PROBE-CLIENT"
        self.domicilio_legal = "PROBE-DOM"
        self.ruc = "PROBE-RUC"
        self.persona_contacto = "PROBE-CONT"
        self.email = "PROBE-EMAIL"
        self.telefono = "PROBE-TEL"
        self.solicitante = "PROBE-SOL"
        self.domicilio_solicitante = "PROBE-DOM-SOL"
        self.proyecto = "PROBE-PROY"
        self.ubicacion = "PROBE-UBIC"
        self.observaciones = "PROBE-OBS-43D"
        self.emision_fisica = True
        self.emision_digital = True
        self.fecha_estimada_culminacion = datetime.now()
        self.entregado_por = "PROBE-ENT-49D"
        self.recibido_por = "PROBE-REC-49I"
        self.muestras = []

def run_probe():
    logic = ExcelLogic()
    recepcion = MockRecepcion()
    
    # Add one sample to avoid empty list issues
    m = MuestraConcreto(
        item_numero=1,
        codigo_muestra_lem="LEM-P",
        codigo_muestra="CLI-P",
        estructura="EST",
        fc_kg_cm2=210.0,
        fecha_moldeo="01/01",
        hora_moldeo="00:00",
        edad=7,
        fecha_rotura="08/01",
        requiere_densidad=True
    )
    recepcion.muestras = [m]
    
    excel_bytes = logic.generar_excel_recepcion(recepcion)
    with open('probe_result.xlsx', 'wb') as f:
        f.write(excel_bytes)
    print("Probe generated: probe_result.xlsx")

if __name__ == "__main__":
    run_probe()
