from excel_logic import ExcelLogic
from database import SessionLocal
from models import RecepcionMuestra
import os
import time

def generate_local_tests():
    db = SessionLocal()
    logic = ExcelLogic()
    ts = int(time.time())
    try:
        for ot_num, label in [("OT-STATIC-TEST", "STATIC"), ("OT-HYBRID-TEST", "HYBRID")]:
            filename = f"TEST_{label}_{ts}.xlsx"
            recepcion = db.query(RecepcionMuestra).filter(RecepcionMuestra.numero_ot == ot_num).first()
            if recepcion:
                print(f"Generating {filename} for {ot_num}...")
                excel_bytes = logic.generar_excel_recepcion(recepcion)
                with open(filename, 'wb') as f:
                    f.write(excel_bytes)
                print(f"Success: {filename} created at {os.path.abspath(filename)}")
            else:
                print(f"Error: Could not find {ot_num} in database.")
    finally:
        db.close()

if __name__ == "__main__":
    generate_local_tests()
