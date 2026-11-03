"""Builds the Model Arrangement standard form (made-up example rows only).
Usage: python3 tools/make-arrangement-template.py skills/midp/templates/Model_Arrangement_Template.xlsx"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

out = sys.argv[1]
wb = Workbook()

NAVY = '1F3A5F'; INK = '1B1B1B'; GREY = '8A8A8A'
HEAD = PatternFill('solid', fgColor=NAVY)
REQ = PatternFill('solid', fgColor='FFF4CC')      # yellow = fill in (required)
OPT = PatternFill('solid', fgColor='EEF3F8')      # light blue = optional
EX = PatternFill('solid', fgColor='F2F2F2')       # grey = example
thin = Side(style='thin', color='C9CED6')
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
EXNOTE = 'EXAMPLE – delete this row'

def sheet(ws, title, cols, examples, rows=int(sys.argv[2]) if len(sys.argv) > 2 else 400):
    ws.title = title
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = 'A3'
    # row 1: one-line help
    ws.cell(1, 1, cols[0][3]).font = Font(italic=True, color='4A5568', size=10)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(cols))
    ws.row_dimensions[1].height = 30
    ws.cell(1, 1).alignment = Alignment(wrap_text=True, vertical='center')
    for j, (name, width, req, _help, tip) in enumerate(cols, 1):
        c = ws.cell(2, j, name + (' *' if req else ''))
        c.font = Font(bold=True, color='FFFFFF'); c.fill = HEAD; c.border = BOX
        c.alignment = Alignment(wrap_text=True, vertical='center')
        if tip: c.comment = Comment(tip, 'Template')
        ws.column_dimensions[c.column_letter].width = width
        for r in range(3, rows + 3):
            cell = ws.cell(r, j); cell.border = BOX
            cell.fill = REQ if req else OPT
            if 'level' in name.lower() and 'name' not in name.lower(): cell.number_format = '@'   # 04 stays 04
    ws.row_dimensions[2].height = 32
    for i, ex in enumerate(examples):
        for j, v in enumerate(ex, 1):
            c = ws.cell(3 + i, j, v)
            c.font = Font(italic=True, color=GREY); c.fill = EX
    return rows

def dv(ws, formula, rng, title, msg, strict=True):
    d = DataValidation(type='list', formula1=formula, allow_blank=True, showDropDown=False)
    d.error = msg; d.errorTitle = title; d.prompt = msg; d.promptTitle = title
    d.showErrorMessage = True; d.showInputMessage = True
    d.errorStyle = 'stop' if strict else 'warning'
    ws.add_data_validation(d); d.add(rng)

# ---------- Read me ----------
rm = wb.active; rm.title = 'Read me'; rm.sheet_view.showGridLines = False
rm.column_dimensions['A'].width = 4; rm.column_dimensions['B'].width = 30; rm.column_dimensions['C'].width = 70
rm['B2'] = 'MODEL ARRANGEMENT – standard form'; rm['B2'].font = Font(bold=True, size=16, color=NAVY)
rm['B3'] = 'Which unit types are on which levels, per building. Fill it from the architect’s stacking / unit mix, then load it in the MIDP Checker → Files → 🏢 Arrangement.'
rm['B3'].alignment = Alignment(wrap_text=True); rm.merge_cells('B3:C3'); rm.row_dimensions[3].height = 32
r = 5
rm.cell(r, 2, 'Project information').font = Font(bold=True, size=12, color=NAVY); r += 1
for k, hint in [('Project name', ''), ('Project code', 'e.g. 1234'), ('Architect', ''), ('Stacking / unit mix revision', 'e.g. Rev M'),
                ('Date received', ''), ('Prepared by', ''), ('Checked by', '')]:
    rm.cell(r, 2, k).font = Font(bold=True); c = rm.cell(r, 3, hint); c.fill = REQ; c.border = BOX
    if hint: c.font = Font(italic=True, color=GREY)
    r += 1
r += 1
rm.cell(r, 2, 'How to fill it').font = Font(bold=True, size=12, color=NAVY); r += 1
steps = [
    ('1. Lists', 'Check the building codes (T1, T2, PD…) and the drop-down words. Add a building here first.'),
    ('2. Levels', 'One row per floor of each building, bottom to top. Use the same level codes as the drawing numbers (04, GF, RF, B1…).'),
    ('3. Units', 'One row per unit type per building. Copy the MIDP title into “MIDP name” — this makes matching exact.'),
    ('4. Placement', 'One row per unit type per building. Levels: list them with commas, ranges with a dash — 05-09, 10, 13, 16, 30. Units per floor = how many on each of those floors; a floor with a different count gets its own row.'),
    ('5. Check', 'Delete the grey EXAMPLE rows. Yellow = required, light blue = optional. Hover a column title for help.'),
]
for k, v in steps:
    rm.cell(r, 2, k).font = Font(bold=True); rm.cell(r, 2).alignment = Alignment(vertical='top'); c = rm.cell(r, 3, v); c.alignment = Alignment(wrap_text=True, vertical='top'); rm.row_dimensions[r].height = 30; r += 1
r += 1
rm.cell(r, 2, 'Rules that avoid mistakes').font = Font(bold=True, size=12, color=NAVY); r += 1
for v in [
    'Same unit name in two buildings = two different unit types (write one row for each building).',
    'Level codes must exist in the Levels sheet (the drop-downs only offer those).',
    'Every level in the Levels column must exist in the Levels sheet. A range that crosses a Technical / Amenities floor is flagged by the checker.',
    'Green columns are counted for you (Floors, Total units) — compare Total units with the architect’s unit mix.',
    'Serviced or hotel floors: set the Classification on each Placement row (not only on the level).',
    'Do not merge cells, do not add blank rows inside the tables, do not rename the sheets or column titles.',
]:
    c = rm.cell(r, 3, '• ' + v); c.alignment = Alignment(wrap_text=True); rm.row_dimensions[r].height = 30; r += 1
r += 1
rm.cell(r, 2, 'Colours').font = Font(bold=True, size=12, color=NAVY); r += 1
for fill, v in [(REQ, 'Required'), (OPT, 'Optional'), (PatternFill('solid', fgColor='E6F4EA'), 'Counted for you – don’t type here'), (EX, 'Example – delete before sending')]:
    a = rm.cell(r, 2, ''); a.fill = fill; a.border = BOX; rm.cell(r, 3, v); r += 1

# ---------- Lists (drop-down sources) ----------
ls = wb.create_sheet('Lists'); ls.sheet_view.showGridLines = False
lists = {
    'A': ('Buildings', ['T1', 'T2', 'PD']),
    'B': ('Building name', ['Tower 1', 'Tower 2', 'Podium']),
    'D': ('Classification', ['Residential', 'Serviced Apartment', 'Hotel Apartment', 'Hotel Room', 'Amenity', 'Retail', 'Office', 'Other']),
    'F': ('Floor type', ['Typical', 'Ground', 'Podium', 'Amenities', 'Technical', 'Roof', 'Basement', 'Mezzanine', 'Other']),
}
for col, (title, vals) in lists.items():
    c = ls[col + '1']; c.value = title; c.font = Font(bold=True, color='FFFFFF'); c.fill = HEAD
    ls.column_dimensions[col].width = 22
    for i, v in enumerate(vals, 2):
        x = ls[f'{col}{i}']; x.value = v; x.border = BOX; x.fill = REQ if col in 'AB' else OPT
ls['H1'] = 'Add your buildings in column A (code) and B (name). The other columns are the drop-down words — add, don’t rename.'
ls['H1'].font = Font(italic=True, color='4A5568'); ls.column_dimensions['H'].width = 60
ls['H1'].alignment = Alignment(wrap_text=True); ls.row_dimensions[1].height = 45

# ---------- Levels ----------
lv = wb.create_sheet('Levels')
n = sheet(lv, 'Levels', [
    ('Building', 11, True, 'One row per floor of each building, bottom to top. Same level codes as the drawing numbers.', 'Building code from Lists (T1, T2, PD…).'),
    ('Level code', 12, True, '', 'As in the drawing number: GF, 01, 04, 13, RF, B1 …'),
    ('Level name', 18, False, '', 'As the architect calls it: Level 4, Roof, Tech floor…'),
    ('Floor type', 14, True, '', 'Typical, Amenities, Technical, Roof…'),
    ('Tier / zone', 12, False, '', 'Tier 1, Tier 2, Low zone… (optional)'),
    ('Floor model number', 32, False, '', 'The federated / typical floor model this level belongs to.'),
    ('Floor model name', 24, False, '', 'e.g. TOW 1 - TIER 1 A'),
    ('Floor-to-floor (m)', 11, False, '', 'Height FFL to FFL (optional).'),
    ('Notes', 26, False, '', ''),
], [
    ('T1', 'GF', 'Ground', 'Ground', '', '', '', 7.0, EXNOTE),
    ('T1', '01', 'Level 1', 'Amenities', '', '', '', 5.0, EXNOTE),
    ('T1', '02', 'Level 2', 'Typical', 'Tier 1', '0000-XXX-T1-T1-BIM-INT-10111', 'TOW 1 - TIER 1 A', 3.6, EXNOTE),
    ('T1', '03', 'Level 3', 'Typical', 'Tier 1', '0000-XXX-T1-T1-BIM-INT-10111', 'TOW 1 - TIER 1 A', 3.6, EXNOTE),
    ('T1', '04', 'Level 4', 'Typical', 'Tier 1', '0000-XXX-T1-T1-BIM-INT-10112', 'TOW 1 - TIER 1 B', 3.6, EXNOTE),
    ('T1', '05', 'Tech floor', 'Technical', '', '', '', 7.2, EXNOTE),
    ('T1', 'RF', 'Roof', 'Roof', '', '', '', 5.4, EXNOTE),
])
dv(lv, '=Lists!$A$2:$A$60', f'A3:A{n+2}', 'Building', 'Pick a building from the Lists sheet.')
dv(lv, '=Lists!$F$2:$F$40', f'D3:D{n+2}', 'Floor type', 'Pick a floor type.')

# ---------- Units ----------
un = wb.create_sheet('Units')
n = sheet(un, 'Units', [
    ('Building', 11, True, 'One row per unit type per building. “MIDP name” = the title text used in the MIDP, so matching is exact.', 'Building code from Lists.'),
    ('Unit type', 14, True, '', 'Short name, written the same way everywhere: 1BR-A, 2BR-C1, STUDIO-A, KING-A…'),
    ('Classification', 18, True, '', 'Residential, Serviced Apartment, Hotel Room…'),
    ('Bedrooms', 10, False, '', 'Number (0 for studio).'),
    ('Typology model number', 32, False, '', 'The model of this unit type (Unit Data).'),
    ('MIDP name', 44, False, '', 'Exactly as in the MIDP title, e.g. UNIT TYPE 1 BR - Type A (Res.1)'),
    ('Other names used', 26, False, '', 'Other spellings in drawings / stacking, comma between: 1-BR-A, 1BR- A'),
    ('Notes', 24, False, '', ''),
], [
    ('T1', '1BR-A', 'Residential', 1, '0000-XXX-ZZ-ZZ-BIM-INT-21000', 'UNIT TYPE 1 BR - Type A (Res.1)', '1-BR-A, 1BR- A', EXNOTE),
    ('T1', '2BR-B', 'Residential', 2, '0000-XXX-ZZ-ZZ-BIM-INT-21012', 'UNIT TYPE 2 BR - Type B (Res.1)', '2-BR-B', EXNOTE),
    ('T2', '1BR-A', 'Serviced Apartment', 1, '0000-XXX-ZZ-ZZ-BIM-INT-22000', 'SV UNIT TYPE 1 BR - Type A (Res.2)', '1-BR-A', EXNOTE),
    ('T2', 'KING-A', 'Hotel Room', 1, '0000-XXX-ZZ-ZZ-BIM-INT-23000', 'KING SUITE - Type A (Hotel)', 'KING SUITE A', EXNOTE),
])
dv(un, '=Lists!$A$2:$A$60', f'A3:A{n+2}', 'Building', 'Pick a building from the Lists sheet.')
dv(un, '=Lists!$D$2:$D$40', f'C3:C{n+2}', 'Classification', 'Pick a classification.')

# ---------- Placement ----------
pl = wb.create_sheet('Placement')
n = sheet(pl, 'Placement', [
    ('Building', 11, True, 'Which unit types are on which floors. One row per building + unit type. Levels: commas between, dash for a range — 05-09, 10, 13, 16, 30.', 'Building code from Lists.'),
    ('Unit type', 14, True, '', 'As written in the Units sheet.'),
    ('Levels', 26, True, '', 'Level codes, comma between. Ranges with a dash. e.g. 05-09, 10, 13, 16, 30  or  GF, 01-03'),
    ('Floors (auto)', 9, False, '', 'Counted for you in Microsoft 365 Excel (blank in older Excel). The checker always counts it on import.'),
    ('Units per floor', 10, True, '', 'How many of this unit type on EACH of those floors. Different count on one floor = add another row.'),
    ('Total units (auto)', 10, False, '', 'Floors × units per floor — compare with the architect’s unit count.'),
    ('Classification', 18, True, '', 'Residential, Serviced Apartment, Hotel Room… (for these floors)'),
    ('Position / façade', 16, False, '', 'Optional: S1, S2, N1… or South / North — draws the stacking in the right order.'),
    ('Notes', 26, False, '', ''),
], [
    ('T1', '1BR-A', '02-04', None, 2, None, 'Residential', 'N1', EXNOTE),
    ('T1', '2BR-B', '02, 04', None, 1, None, 'Residential', 'S1', EXNOTE),
    ('T2', '2BR-C', '05-09, 10, 13, 16, 30', None, 1, None, 'Residential', 'S2', EXNOTE),
    ('T2', '2BR-C', '11', None, 2, None, 'Residential', 'S2', EXNOTE + ' (L11 has 2 of them)'),
    ('T2', '1BR-A', '19-29', None, 3, None, 'Serviced Apartment', 'N2', EXNOTE),
    ('T2', 'KING-A', '04-11', None, 4, None, 'Hotel Room', 'N3', EXNOTE),
])
AUTO = PatternFill('solid', fgColor='E6F4EA')
FLOORS = ('=IF(C{r}="","",IFERROR(_xlfn.LET(_xlpm.p,TRIM(_xlfn.TEXTSPLIT(C{r},",")),SUM(_xlfn.MAP(_xlpm.p,_xlfn.LAMBDA(_xlpm.x,'
          'IF(ISNUMBER(SEARCH("-",_xlpm.x)),VALUE(_xlfn.TEXTAFTER(_xlpm.x,"-"))-VALUE(_xlfn.TEXTBEFORE(_xlpm.x,"-"))+1,1))))),""))')
for rr in range(3, n + 3):
    for col, f in (('D', FLOORS.format(r=rr)), ('F', '=IF(OR(D{r}="",E{r}=""),"",D{r}*E{r})'.format(r=rr))):
        c = pl[col + str(rr)]; c.value = f; c.fill = AUTO
        c.font = Font(italic=rr < 9, color=GREY if rr < 9 else INK)
for rr in range(3, n + 3): pl['C%d' % rr].number_format = '@'
dv(pl, '=Lists!$A$2:$A$60', f'A3:A{n+2}', 'Building', 'Pick a building from the Lists sheet.')
dv(pl, '=Units!$B$3:$B$600', f'B3:B{n+2}', 'Unit type', 'Not in the Units sheet — add it there, or check the spelling.', strict=False)
dv(pl, '=Lists!$D$2:$D$40', f'G3:G{n+2}', 'Classification', 'Pick a classification.')

# order: Read me, Levels, Units, Placement, Lists
wb._sheets = [rm, lv, un, pl, ls]
for ws in wb.worksheets:
    ws.sheet_properties.tabColor = {'Read me': NAVY, 'Lists': '8A8A8A'}.get(ws.title, 'D9A400')
wb.properties.creator = 'Lew’s Tracker'; wb.properties.title = 'Model Arrangement – standard form'
wb.save(out)
print('saved', out)
