import zipfile
from lxml import etree

NAMESPACES = {
    'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
}

def verify():
    file_path = 'backend/SURGICAL_VALIDATION_FINAL_V6.xlsx'
    with zipfile.ZipFile(file_path, 'r') as z:
        if 'xl/drawings/drawing1.xml' in z.namelist():
            draw_xml = z.read('xl/drawings/drawing1.xml')
            d_root = etree.fromstring(draw_xml)
            anchors = d_root.xpath('//xdr:twoCellAnchor | //xdr:oneCellAnchor', namespaces=NAMESPACES)
            for i, anchor in enumerate(anchors):
                from_row = anchor.find('.//xdr:from/xdr:row', namespaces=NAMESPACES)
                from_col = anchor.find('.//xdr:from/xdr:col', namespaces=NAMESPACES)
                f_r = from_row.text if from_row is not None else "N/A"
                f_c = from_col.text if from_col is not None else "N/A"
                print(f"Drawing {i}: FromRow={f_r}, FromCol={f_c}")
        else:
            print("No drawing1.xml found in generated file")

if __name__ == "__main__":
    verify()
