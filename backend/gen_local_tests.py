from excel_logic import ExcelLogic
from database import SessionLocal
from models import RecepcionMuestra
import os

def generate_local_tests():
    db = SessionLocal()
    logic = ExcelLogic()
    try:
        for ot_num, filename in [("OT-STATIC-TEST", "STATIC_TEST_FINAL.xlsx"), ("OT-HYBRID-TEST", "HYBRID_TEST_FINAL.xlsx")]:
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
