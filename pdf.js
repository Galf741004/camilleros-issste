const LOGOS_CACHE = { cargado: false, bandera: null, anio2026: null };

async function cargarImagenBase64(ruta) {
  try {
    const resp = await fetch(ruta);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

async function asegurarLogos() {
  if (LOGOS_CACHE.cargado) return LOGOS_CACHE;
  const [b, a] = await Promise.all([
    cargarImagenBase64('assets/logo_bandera.png'),
    cargarImagenBase64('assets/logo_2026.png')
  ]);
  LOGOS_CACHE.bandera = b;
  LOGOS_CACHE.anio2026 = a;
  LOGOS_CACHE.cargado = true;
  return LOGOS_CACHE;
}

function extraerDigitosFecha(fechaIso) {
  if (!fechaIso || fechaIso.indexOf('-') === -1) {
    return { d1: '', d2: '', m1: '', m2: '', a1: '', a2: '' };
  }
  const p = String(fechaIso).split('-');
  const anio = p[0].slice(-2);
  const mes = p[1];
  const dia = p[2];
  return {
    d1: dia.charAt(0), d2: dia.charAt(1),
    m1: mes.charAt(0), m2: mes.charAt(1),
    a1: anio.charAt(0), a2: anio.charAt(1)
  };
}

function bloqueEncabezadoLogos(logos) {
  if (logos.bandera) {
    return { image: logos.bandera, width: 536, margin: [0, 0, 0, 6] };
  }
  return { text: 'GOBIERNO DE MÉXICO | ISSSTE', bold: true, fontSize: 10, color: '#9F2241', margin: [0, 0, 0, 8] };
}

function bloquePieLogos(logos) {
  if (logos.anio2026) {
    return { image: logos.anio2026, width: 536, margin: [0, 8, 0, 0] };
  }
  return { text: '2026 año de Margarita Maza', bold: true, fontSize: 8, color: '#9F2241', margin: [0, 10, 0, 0] };
}

function bloqueFirmasConLinea(izqNombre, izqCargo, derNombre, derCargo, marginTop) {
  return {
    table: {
      widths: ['45%', '10%', '45%'],
      body: [
        [
          { text: izqNombre, alignment: 'center', fontSize: 8.5, bold: true, border: [false, false, false, false], margin: [0, 0, 0, 2] },
          { text: '', border: [false, false, false, false] },
          { text: derNombre, alignment: 'center', fontSize: 8.5, bold: true, border: [false, false, false, false], margin: [0, 0, 0, 2] }
        ],
        [
          { text: izqCargo, alignment: 'center', fontSize: 7.5, border: [false, true, false, false], margin: [0, 3, 0, 0] },
          { text: '', border: [false, false, false, false] },
          { text: derCargo, alignment: 'center', fontSize: 7.5, border: [false, true, false, false], margin: [0, 3, 0, 0] }
        ]
      ]
    },
    layout: { defaultBorder: true },
    margin: [0, marginTop || 18, 0, 0]
  };
}

function construirPaginaAnexo7(d, ini, fin, logos, conTituloAnexo) {
  const bloque = [];
  bloque.push(bloqueEncabezadoLogos(logos));
  if (conTituloAnexo) {
    bloque.push({ text: 'ANEXO 7', alignment: 'center', bold: true, fontSize: 10.5, margin: [0, 0, 0, 2] });
  }
  bloque.push({ text: 'FORMATO DE SOLICITUD DEL PLIEGO DE LA COMISIÓN', alignment: 'center', bold: true, fontSize: 10.5, margin: [0, 0, 0, 6] });
  bloque.push({
    text: [{ text: 'Folio:  ', bold: true }, { text: d.num_oficio, decoration: 'underline' }],
    alignment: 'right', fontSize: 8.5
  });
  bloque.push({
    text: [{ text: 'Fecha: ', bold: true }, { text: d.fecha_oficio_texto, decoration: 'underline' }],
    alignment: 'right', fontSize: 8.5, margin: [0, 0, 0, 4]
  });

  bloque.push({ text: 'I. Datos de la Unidad Responsable', bold: true, fontSize: 8.5, margin: [0, 2, 0, 2] });
  bloque.push({
    table: { widths: ['*'], body: [[{ text: 'Nombre y Clave:   Hospital Regional León', fontSize: 8 }]] },
    margin: [0, 0, 0, 5]
  });

  bloque.push({ text: 'II. Datos sobre el Servidor Público Comisionado', bold: true, fontSize: 8.5, margin: [0, 2, 0, 2] });
  bloque.push({
    table: {
      widths: ['58%', '42%'],
      body: [
        [{ text: `Nombre:   ${d.camillero_nombre}`, fontSize: 8 }, { text: `R. F. C.:   ${d.rfc_camillero}`, fontSize: 8 }],
        [{ text: 'Cargo:   CAMILLERO', fontSize: 8 }, { text: 'Referencia:', fontSize: 8 }],
        [{ text: 'Adscripción:   HOSPITAL REGIONAL LEON    1120000000', fontSize: 8 }, { text: `No. de Empleado:   ${d.num_empleado}`, fontSize: 8 }]
      ]
    },
    margin: [0, 0, 0, 5]
  });

  bloque.push({ text: 'III.- Datos sobre viáticos y pasajes', bold: true, fontSize: 8.5, margin: [0, 2, 0, 2] });
  bloque.push({
    table: {
      widths: ['26%', '6%', '6%', '6%', '6%', '6%', '6%', '10%', '12%', '16%'],
      heights: [12, 12, 12, 16, 13, 13, 15],
      body: [
        [
          { text: 'Destino Nacional Ciudad./Estado\nInternacional País/Ciudad', rowSpan: 3, fontSize: 7.5, alignment: 'center' },
          { text: 'Período', colSpan: 6, fontSize: 8, bold: true, alignment: 'center' }, {}, {}, {}, {}, {},
          { text: 'No. de Días', rowSpan: 3, fontSize: 7.5, bold: true, alignment: 'center' },
          { text: 'Cuota por Día', rowSpan: 3, fontSize: 7.5, bold: true, alignment: 'center' },
          { text: 'Importe de Viáticos', rowSpan: 3, fontSize: 7.5, bold: true, alignment: 'center' }
        ],
        [
          {},
          { text: 'Fecha de Inicio', colSpan: 3, fontSize: 7, alignment: 'center' }, {}, {},
          { text: 'Fecha de Término', colSpan: 3, fontSize: 7, alignment: 'center' }, {}, {},
          {}, {}, {}
        ],
        [
          {},
          { text: 'AÑO', fontSize: 7, alignment: 'center' }, { text: 'MES', fontSize: 7, alignment: 'center' }, { text: 'DÍA', fontSize: 7, alignment: 'center' },
          { text: 'AÑO', fontSize: 7, alignment: 'center' }, { text: 'MES', fontSize: 7, alignment: 'center' }, { text: 'DÍA', fontSize: 7, alignment: 'center' },
          {}, {}, {}
        ],
        [
          { text: d.ciudad, fontSize: 8, alignment: 'center' },
          { text: `${ini.a1}${ini.a2}`, fontSize: 8, alignment: 'center' },
          { text: `${ini.m1}${ini.m2}`, fontSize: 8, alignment: 'center' },
          { text: `${ini.d1}${ini.d2}`, fontSize: 8, alignment: 'center' },
          { text: `${fin.a1}${fin.a2}`, fontSize: 8, alignment: 'center' },
          { text: `${fin.m1}${fin.m2}`, fontSize: 8, alignment: 'center' },
          { text: `${fin.d1}${fin.d2}`, fontSize: 8, alignment: 'center' },
          { text: '1', fontSize: 8, alignment: 'center' },
          { text: '$490', fontSize: 8, alignment: 'center' },
          { text: '$490', fontSize: 8, alignment: 'center' }
        ],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
        [
          { text: 'Tipo de Viáticos', fontSize: 8 },
          { text: 'Anticipados   X', colSpan: 4, fontSize: 8 }, {}, {}, {},
          { text: 'Devengados', colSpan: 3, fontSize: 8 }, {}, {},
          { text: 'TOTAL', bold: true, fontSize: 8, alignment: 'center' },
          { text: '$490', bold: true, fontSize: 8, alignment: 'center' }
        ]
      ]
    },
    margin: [0, 0, 0, 5]
  });

  bloque.push({ text: 'Importe Total de Viáticos:   $ _____490_____', alignment: 'center', fontSize: 8.5, margin: [0, 2, 0, 5] });
  bloque.push({ text: 'Pasaje Avión: (  )  Autobús: (  )  Automóvil Particular: (  )  Otros Especifique: ( X )  AMBULANCIA   Importe: ___$490___', fontSize: 8, margin: [0, 0, 0, 5] });
  bloque.push({ text: '(______________________________________________________________________________________________)', fontSize: 8, margin: [0, 0, 0, 5] });
  bloque.push({ text: 'No.   de   Tarjeta: _____________________________________   Clave   de   Banco: ___________________________', fontSize: 8, margin: [0, 0, 0, 7] });

  bloque.push({ text: 'Objeto de la comisión detallando el propósito de la misma:', bold: true, fontSize: 8.5, margin: [0, 0, 0, 2] });
  bloque.push({
    table: {
      widths: ['*'],
      heights: [24, 13],
      body: [
        [{ text: `ACUDIR AL TRASLADO DEL PACIENTE ${d.paciente_nombre}, CON CEDULA ${d.cedula} AL ${d.hospital} A LA ${d.ciudad}.`, fontSize: 8, margin: [2, 2, 2, 2] }],
        [' ']
      ]
    },
    margin: [0, 0, 0, 5]
  });

  bloque.push({ text: 'Clave Presupuestal:', fontSize: 8.5, margin: [0, 0, 0, 2] });
  bloque.push({
    table: {
      widths: ['*'],
      body: [[{ text: '2026-2-3-02-56-14-005-M002-M02-11-037-203-00-020-1-37204-0000-00\n2026-2-3-02-56-14-005-M002-M02-11-037-203-00-020-1-37504-0000-00', fontSize: 8 }]]
    },
    margin: [0, 0, 0, 4]
  });

  bloque.push(bloqueFirmasConLinea(
    'DR. EDILBERTO HERNÁNDEZ CÁRDENAS', 'SERVIDOR PÚBLICO QUE AUTORIZA',
    d.camillero_nombre, 'COMISIONADO', 20
  ));
  bloque.push(bloquePieLogos(logos));
  return bloque;
}

function construirPaginaReversoAnexo7(d) {
  return [
    { text: 'REVERSO ANEXO 7', alignment: 'center', bold: true, fontSize: 10, margin: [0, 0, 0, 6] },
    {
      table: {
        widths: ['50%', '50%'],
        heights: [96, 96, 96, 96, 96],
        body: Array.from({ length: 5 }, () => [{ text: ' ' }, { text: ' ' }])
      },
      margin: [0, 0, 0, 10]
    },
    { text: 'El funcionario que certifica la permanencia del comisionado. Acepta la responsabilidad que esto representa.', fontSize: 8.5, margin: [0, 0, 0, 6] },
    { text: 'A) El comisionado declara bajo protesta que los documentos comprobatorios del presente viatico son verídicos. Mismos que pueden ser compulsados por cualquier área reguladora.', fontSize: 8.5, margin: [0, 0, 0, 18] },
    { text: `Comisionado\n\n${d.camillero_nombre}`, alignment: 'center', fontSize: 9, bold: true }
  ];
}

async function generarYDescargarPDF(d, tipoDocumento) {
  if (tipoDocumento === 'SOLO_GUARDAR') return;
  const logos = await asegurarLogos();
  const ini = extraerDigitosFecha(d.fecha_inicio);
  const fin = extraerDigitosFecha(d.fecha_fin);
  const content = [];

  if (tipoDocumento === 'SOLO_VIATICOS') {
    content.push(...construirPaginaAnexo7(d, ini, fin, logos, false));
    content.push({ text: '', pageBreak: 'before' });
    content.push(...construirPaginaReversoAnexo7(d));
  } else {
    // PÁGINA 1: OFICIO COORDINACIÓN DE ENFERMERÍA
    content.push(bloqueEncabezadoLogos(logos));
    content.push({
      text: `HOSPITAL REGIONAL LEÓN\nSubdirección Médica\nCoordinación de Enfermería\n\nOFICIO No. ${d.num_oficio}\n\nLeón, Guanajuato, a ${d.fecha_oficio_texto}\n\nAsunto: traslado de paciente`,
      alignment: 'right', fontSize: 9.5, bold: true, margin: [0, 4, 0, 16]
    });
    content.push({ text: 'LIC. LUIS SALVADOR CASTRO ROJAS\nCOORDINADOR DE RECURSOS FINANCIEROS\nP R E S E N T E.', bold: true, fontSize: 9.5, margin: [0, 0, 0, 16] });
    content.push({
      text: `Me permito informar a usted, que el C. ${d.camillero_nombre}, Camillero, con número de empleado ${d.num_empleado}, acudirá al traslado del paciente, ${d.paciente_nombre}, con cédula ${d.cedula}, el día ${d.fecha_inicio_texto || d.fecha_oficio_texto}, al ${d.hospital} en ${d.ciudad}.\n\nPor lo anterior, solicito le sean proporcionados los viáticos correspondientes.\n\nAgradeciendo sus atenciones, quedo de usted.`,
      fontSize: 10, alignment: 'justify', lineHeight: 1.35, margin: [0, 0, 0, 22]
    });
    content.push({ text: 'A T E N T A M E N T E\n\n\nL.E. ANGELICA TORRES LEÓN\nCOORDINADORA DE ENFERMERÍA', bold: true, fontSize: 9.5, margin: [0, 0, 0, 22] });
    content.push({ text: 'Con copia:\n-Minutario.', fontSize: 8.5, margin: [0, 0, 0, 40] });
    content.push(bloquePieLogos(logos));

    // PÁGINA 2: ANEXO 7
    content.push({ text: '', pageBreak: 'before' });
    content.push(...construirPaginaAnexo7(d, ini, fin, logos, true));

    // PÁGINA 3: REVERSO ANEXO 7
    content.push({ text: '', pageBreak: 'before' });
    content.push(...construirPaginaReversoAnexo7(d));

    // PÁGINA 4: OFICIO DE COMISIÓN
    content.push({ text: '', pageBreak: 'before' });
    content.push(bloqueEncabezadoLogos(logos));
    content.push({ text: 'OFICIO DE COMISIÓN', alignment: 'center', bold: true, fontSize: 11, margin: [0, 2, 0, 8] });
    content.push({
      text: `HOSPITAL REGIONAL LEÓN\nOficio de comisión No.   ${d.num_oficio}\nLeón, Guanajuato, a ${d.fecha_oficio_texto}`,
      alignment: 'right', bold: true, fontSize: 9.5, margin: [0, 0, 0, 14]
    });
    content.push({ text: `${d.camillero_nombre}\nCAMILLERO\nCAMILLERÍA\nPRESENTE`, bold: true, fontSize: 9.5, margin: [0, 0, 0, 12] });
    content.push({ text: 'Por este conducto me permito informarle que, con la finalidad de cumplir con las metas encomendadas a esta Unidad Administrativa, ha sido designado a cumplir con la comisión que a continuación se detalla:', fontSize: 9.5, margin: [0, 0, 0, 12] });
    content.push({
      table: {
        widths: ['32%', '68%'],
        body: [
          ['Lugar de la Comisión:', { text: d.hospital, bold: true }],
          ['Período de la Comisión:', { text: d.intervalo_fechas, bold: true }],
          ['Objetivo:', { text: `ACUDIR AL TRASLADO DEL PACIENTE ${d.paciente_nombre}`, bold: true }],
          ['Proyecto o Programa:', { text: 'TRASLADO DE PACIENTE', bold: true }]
        ]
      },
      layout: 'noBorders', fontSize: 9.5, margin: [0, 0, 0, 14]
    });
    content.push({
      text: 'Por lo anterior, lo instruyo para que se presente en la Coordinación Administrativa (u homólogo) con el presente documento para el otorgamiento de viáticos y pasajes.\n\nLa comprobación de viáticos deberá ser entregada en UN PLAZO MÁXIMO DE 3 DÍAS HÁBILES, a partir de la conclusión de la comisión.\n\nSin otro particular, reciba un cordial saludo.',
      fontSize: 9.5, lineHeight: 1.3, margin: [0, 0, 0, 22]
    });
    content.push({ text: 'ATENTAMENTE\n\n\nDR. EDILBERTO HERNÁNDEZ CÁRDENAS\nDIRECTOR DEL HOSPITAL REGIONAL LEÓN', alignment: 'center', bold: true, fontSize: 9.5, margin: [0, 0, 0, 24] });
    content.push(bloquePieLogos(logos));

    // PÁGINA 5: AVISO DE COMISIÓN / ORDEN DE MINISTRACIÓN
    content.push({ text: '', pageBreak: 'before' });
    content.push(bloqueEncabezadoLogos(logos));
    content.push({ text: 'Aviso de Comisión / Orden de Ministración de Viáticos y Pasajes', alignment: 'center', bold: true, fontSize: 10.5, margin: [0, 0, 0, 4] });
    content.push({ text: `Folio:\nOficio de comisión No. ${d.num_oficio}\nFecha: ${d.fecha_oficio_texto}`, alignment: 'right', bold: true, fontSize: 8.5, margin: [0, 0, 0, 6] });
    content.push({ text: 'I. Datos de la Unidad Administrativa', bold: true, fontSize: 8.5 });
    content.push({ text: 'Nombre y Clave:   HOSPITAL REGIONAL LEÓN    1120000000', fontSize: 8.5, margin: [12, 2, 0, 6] });
    content.push({ text: 'II. Datos sobre el Servidor Público Comisionado', bold: true, fontSize: 8.5 });
    content.push({
      table: {
        widths: ['55%', '45%'],
        body: [
          [`Nombre: ${d.camillero_nombre}`, `R.F.C.: ${d.rfc_camillero}`],
          ['Cargo: CAMILLERO', 'Domicilio: PRADERA NO. 1101, COL. AZTECA, LEON GTO.'],
          ['Adscripción: HOSPITAL REGIONAL LEÓN', `No. Empleado: ${d.num_empleado}`]
        ]
      },
      layout: 'noBorders', fontSize: 8, margin: [0, 2, 0, 6]
    });
    content.push({ text: 'VIÁTICOS', bold: true, fontSize: 8.5, margin: [0, 2, 0, 2] });
    content.push({
      table: {
        widths: ['26%', '6%', '6%', '6%', '6%', '6%', '6%', '10%', '12%', '16%'],
        body: [
          [
            { text: 'Destino', rowSpan: 3, bold: true, fontSize: 8, alignment: 'center' },
            { text: 'Período', colSpan: 6, bold: true, fontSize: 8, alignment: 'center' }, {}, {}, {}, {}, {},
            {
