const SUPABASE_URL = 'https://wodlvgzdfumrlqaarmvl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Acudb1RPphspbsaxFBFhIg_zGfnf8CL';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
let currentUser = null;
let personal = [];
let destinos = [];
let pendientesGlobal = [];
let concluidosGlobal = [];
let sugerenciaOficioGlobal = '';
let registroSeleccionadoActual = null;
let temporizadorInactividad = null;
const TIEMPO_LIMITE_INACTIVIDAD = 1800000;

let modalInstanceConfirmacion, modalInstanceResultados, modalInstanceExpirada, modalInstanceCamillero, modalInstanceHospital;

window.onload = async function () {
  modalInstanceConfirmacion = new bootstrap.Modal(document.getElementById('modalConfirmacion'));
  modalInstanceResultados = new bootstrap.Modal(document.getElementById('modalResultadosBusqueda'));
  modalInstanceExpirada = new bootstrap.Modal(document.getElementById('modalSesionExpirada'));
  modalInstanceCamillero = new bootstrap.Modal(document.getElementById('modalEdicionCamillero'));
  modalInstanceHospital = new bootstrap.Modal(document.getElementById('modalEdicionHospital'));

  configurarValidacionVisualYMayusculas();

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await cargarPerfilYEntrar(session.user.id);
  } else {
    mostrarVistaAuth('loginView');
  }
};

function iniciarMonitoreoInactividad() {
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  window.onmousedown = reiniciarTemporizadorInactividad;
  window.onkeydown = reiniciarTemporizadorInactividad;
  window.ontouchstart = reiniciarTemporizadorInactividad;
  window.addEventListener('scroll', reiniciarTemporizadorInactividad, true);
  reiniciarTemporizadorInactividad();
}

function reiniciarTemporizadorInactividad() {
  if (!currentUser) return;
  clearTimeout(temporizadorInactividad);
  temporizadorInactividad = setTimeout(ejecutarCierrePorInactividad, TIEMPO_LIMITE_INACTIVIDAD);
}

async function ejecutarCierrePorInactividad() {
  if (!currentUser) return;
  await sb.auth.signOut();
  currentUser = null;
  document.getElementById('appView').style.display = 'none';
  modalInstanceExpirada.show();
}

function redirigirALoginExpirado() {
  modalInstanceExpirada.hide();
  mostrarVistaAuth('loginView');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));
}

function mostrarVistaAuth(viewId) {
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  document.getElementById('appView').style.display = 'none';
  const el = document.getElementById(viewId);
  if (el) el.classList.add('active');
}

async function ejecutarLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('btnLoginSubmit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verificando...';

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await sb.rpc('registrar_mi_login');
    await cargarPerfilYEntrar(data.user.id);
  } catch (err) {
    alert('No se pudo ingresar: ' + (err.message || 'Verifica correo y contraseña.'));
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Ingresar al sistema';
  }
}

async function cargarPerfilYEntrar(uid) {
  const { data: perfil, error } = await sb.from('perfiles').select('*').eq('id', uid).single();
  if (error || !perfil) {
    alert('Tu cuenta aún no tiene perfil asignado. Contacta al administrador.');
    await sb.auth.signOut();
    return mostrarVistaAuth('loginView');
  }
  if (perfil.estado !== 'Activo') {
    alert('Cuenta inactiva. Contacta al administrador.');
    await sb.auth.signOut();
    return mostrarVistaAuth('loginView');
  }

  currentUser = { id: perfil.id, email: perfil.email, name: perfil.nombre_completo, role: perfil.rol };
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  document.getElementById('appView').style.display = 'block';
  document.getElementById('headerUserName').textContent = currentUser.name;
  document.getElementById('headerUserRole').textContent = currentUser.role;

  const adminSection = document.getElementById('adminMenuSection');
  if (currentUser.role === 'Admin') adminSection.classList.remove('d-none');
  else adminSection.classList.add('d-none');

  const tabRegreso = document.getElementById('tab-regreso');
  const btnEjecutar = document.getElementById('btnEjecutar');
  tabRegreso.classList.remove('disabled');
  tabRegreso.removeAttribute('tabindex');
  btnEjecutar.classList.remove('d-none');

  if (currentUser.role === 'Fase 1 (Salida)') {
    tabRegreso.classList.add('disabled');
    tabRegreso.setAttribute('tabindex', '-1');
    cambiarFase(1);
  } else if (currentUser.role === 'Fase 2 (Cierre)') {
    new bootstrap.Tab(tabRegreso).show();
    cambiarFase(2);
  } else if (currentUser.role === 'Consulta') {
    btnEjecutar.classList.add('d-none');
    cambiarFase(1);
  } else {
    cambiarFase(1);
  }

  iniciarMonitoreoInactividad();
  await cargarCatalogosServidor();
  limpiarFormulario();
}

async function ejecutarLogout() {
  if (temporizadorInactividad) clearTimeout(temporizadorInactividad);
  await sb.auth.signOut();
  currentUser = null;
  mostrarVistaAuth('loginView');
}

function toggleSidebar() {
  document.getElementById('mainSidebar').classList.toggle('active');
  document.getElementById('sidebarBackdrop').classList.toggle('active');
}

function mostrarSeccionApp(seccionId) {
  const seccionesAdmin = ['seccionCatalogos', 'seccionGestionarUsuarios', 'seccionTrazabilidad', 'seccionRespaldos'];
  if (seccionesAdmin.includes(seccionId) && currentUser.role !== 'Admin') {
    alert('Acceso restringido: se requieren permisos de Administrador.');
    return;
  }
  document.querySelectorAll('.app-sub-section').forEach(s => s.classList.add('d-none'));
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  const destino = document.getElementById(seccionId);
  if (destino) destino.classList.remove('d-none');
  const btnActivo = document.querySelector(`.sidebar-btn[data-sec="${seccionId}"]`);
  if (btnActivo) btnActivo.classList.add('active');

  if (window.innerWidth < 992 && document.getElementById('mainSidebar').classList.contains('active')) {
    toggleSidebar();
  }
}

async function actualizarMiPerfil(e) {
  e.preventDefault();
  const n1 = document.getElementById('perfNueva').value;
  const n2 = document.getElementById('perfConfirmar').value;
  if (n1 !== n2) return alert('Las contraseñas nuevas no coinciden.');
  const { error } = await sb.auth.updateUser({ password: n1 });
  if (error) return alert('Error al actualizar: ' + error.message);
  alert('Contraseña actualizada correctamente.');
  document.getElementById('perfNueva').value = '';
  document.getElementById('perfConfirmar').value = '';
}

function cambiarFase(num) {
  const docSel = document.getElementById('tipoDocumento');
  if (num === 1) {
    docSel.innerHTML = `
      <option value="SOLO_VIATICOS">1. Solicitud de viáticos (Anexo 7 y reverso — 2 páginas)</option>
      <option value="SOLO_GUARDAR">2. Solo guardar datos (Sin generar archivo PDF)</option>
    `;
  } else {
    docSel.innerHTML = `
      <option value="COMPLETO">1. Expediente completo oficial (7 páginas)</option>
      <option value="SOLO_VIATICOS">2. Reimprimir solicitud de viáticos (Anexo 7 — 2 páginas)</option>
      <option value="SOLO_GUARDAR">3. Solo guardar datos (Sin generar archivo PDF)</option>
    `;
  }
}

async function cargarCatalogosServidor() {
  const [resCam, resHosp, resPend, resConc, resFolio] = await Promise.all([
    sb.from('camilleros').select('*').eq('activo', true).order('nombre'),
    sb.from('hospitales').select('*').eq('activo', true).order('hospital'),
    sb.from('comisiones').select('*').is('fecha_elaboracion', null).order('id', { ascending: false }),
    sb.from('comisiones').select('*').not('fecha_elaboracion', 'is', null).order('id', { ascending: false }).limit(8),
    sb.rpc('obtener_siguiente_folio_sugerido')
  ]);

  personal = resCam.data || [];
  destinos = resHosp.data || [];
  pendientesGlobal = resPend.data || [];
  concluidosGlobal = resConc.data || [];
  sugerenciaOficioGlobal = resFolio.data || '';

  const selCam = document.getElementById('selectCamillero');
  selCam.innerHTML = '<option value="">Seleccione personal...</option>';
  personal.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.nombre;
    opt.textContent = p.nombre;
    selCam.appendChild(opt);
  });

  const selHosp = document.getElementById('selectHospital');
  selHosp.innerHTML = '<option value="">Seleccione hospital...</option>';
  destinos.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.hospital;
    opt.textContent = d.hospital;
    selHosp.appendChild(opt);
  });

  if (!document.getElementById('registroId').value) {
    document.getElementById('numOficio').value = sugerenciaOficioGlobal;
    evaluarCampo(document.getElementById('numOficio'));
  }

  document.getElementById('kpiPendientesCount').textContent = pendientesGlobal.length;
  document.getElementById('kpiConcluidosCount').textContent = concluidosGlobal.length;
  const maxNum = [...pendientesGlobal, ...concluidosGlobal].reduce((m, r) => Math.max(m, r.consecutivo || 0), 0);
  document.getElementById('kpiUltimoFolio').textContent = maxNum ? `${maxNum}-T` : '-';

  actualizarTablerosFase2UI();
  if (currentUser && currentUser.role === 'Admin') cargarCatalogosAdmin();
}

function actualizarTablerosFase2UI() {
  const boxBandeja = document.getElementById('boxBandejaPendientes');
  const badgeTab = document.getElementById('badgeContadorPendientes');
  const labelContador = document.getElementById('labelContadorPendientes');
  const contenedorPend = document.getElementById('listaPendientesCards');

  if (pendientesGlobal.length > 0) {
    badgeTab.textContent = pendientesGlobal.length;
    badgeTab.classList.remove('d-none');
    labelContador.textContent = `${pendientesGlobal.length} pendientes`;
    boxBandeja.classList.remove('d-none');
    contenedorPend.innerHTML = '';
    pendientesGlobal.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-12 col-md-6';
      col.innerHTML = `
        <div class="card p-2 h-100 border shadow-sm" style="font-size: 0.82rem; background: #FFFFFF;">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <span class="badge bg-secondary font-monospace">${escapeHTML(item.num_oficio)} | ${escapeHTML(item.fecha_inicio)}</span>
            <button type="button" class="btn btn-sm btn-guinda py-0 px-2 fw-semibold" style="font-size: 0.76rem;" onclick="cargarRegistroPorId(${item.id}, true)">
              <i class="bi bi-lightning-fill text-warning me-1"></i>Completar informe
            </button>
          </div>
          <div><strong class="text-dark">${escapeHTML(item.paciente_nombre)}</strong></div>
          <div class="text-muted"><i class="bi bi-person me-1"></i>${escapeHTML(item.camillero_nombre)}</div>
          <div class="text-muted"><i class="bi bi-hospital me-1"></i>${escapeHTML(item.hospital)} (${escapeHTML(item.ciudad)})</div>
        </div>
      `;
      contenedorPend.appendChild(col);
    });
  } else {
    badgeTab.classList.add('d-none');
    boxBandeja.classList.add('d-none');
  }

  const boxConcluidos = document.getElementById('boxBandejaConcluidos');
  const contenedorConc = document.getElementById('listaConcluidosCards');
  if (concluidosGlobal.length > 0) {
    boxConcluidos.classList.remove('d-none');
    contenedorConc.innerHTML = '';
    concluidosGlobal.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-12 col-md-6';
      col.innerHTML = `
        <div class="card p-2 h-100 border border-success-subtle shadow-sm" style="font-size: 0.82rem; background: #FFFFFF;">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <strong class="text-dark font-monospace">${escapeHTML(item.num_oficio)}</strong>
            <button type="button" class="btn btn-sm btn-outline-success py-0 px-2 fw-semibold" style="font-size: 0.76rem;" onclick="descargarDesdeLista(${item.id})">
              <i class="bi bi-file-earmark-pdf me-1"></i>Descargar PDF
            </button>
          </div>
          <div class="text-truncate"><strong>${escapeHTML(item.paciente_nombre)}</strong></div>
          <div class="text-muted small"><i class="bi bi-person me-1"></i>${escapeHTML(item.camillero_nombre)}</div>
        </div>
      `;
      contenedorConc.appendChild(col);
    });
  } else {
    boxConcluidos.classList.add('d-none');
  }
}

async function descargarDesdeLista(id) {
  const { data } = await sb.from('comisiones').select('*').eq('id', id).single();
  if (data) await generarYDescargarPDF(prepararParaPdf(data), 'COMPLETO');
}

function prepararParaPdf(r) {
  return { ...r, fecha_inicio_texto: fechaIsoATexto(r.fecha_inicio), fecha_fin_texto: fechaIsoATexto(r.fecha_fin) };
}

async function cargarRegistroPorId(id, esCierreRapido) {
  const { data, error } = await sb.from('comisiones').select('*').eq('id', id).single();
  if (error || !data) return alert('No se pudo cargar el registro.');
  llenarFormularioEdicion(data);
  if (esCierreRapido && !data.fecha_elaboracion) {
    const hoy = new Date().toLocaleDateString('en-CA');
    document.getElementById('fechaElaboracion').value = hoy;
    evaluarCampo(document.getElementById('fechaElaboracion'));
    document.getElementById('factura').focus();
  }
}

async function ejecutarBusquedaUniversal() {
  const crit = document.getElementById('inputBuscar').value.trim().toUpperCase();
  const filtro = document.getElementById('filtroEstadoBusqueda').value;
  const btn = document.getElementById('btnBuscar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

  try {
    let query = sb.from('comisiones').select('*').order('id', { ascending: false }).limit(200);
    if (!crit) {
      if (filtro === 'SOLO_PENDIENTES') query = query.is('fecha_elaboracion', null);
      if (filtro === 'SOLO_CONCLUIDOS') query = query.not('fecha_elaboracion', 'is', null);
    }
    const { data, error } = await query;
    if (error) throw error;

    const resultados = (data || []).filter(r => {
      if (!crit) return true;
      return [r.num_oficio, r.num_empleado, r.rfc_camillero, r.camillero_nombre, r.paciente_nombre, r.cedula]
        .some(v => String(v || '').toUpperCase().includes(crit));
    });

    if (resultados.length === 0) {
      alert('No se encontraron traslados con el criterio ingresado.');
      return;
    }
    if (resultados.length === 1) {
      llenarFormularioEdicion(resultados[0]);
      return;
    }

    document.getElementById('badgeTotalResultados').textContent = `${resultados.length} traslados encontrados`;
    const tbody = document.getElementById('tablaResultadosCuerpo');
    tbody.innerHTML = '';
    resultados.forEach(item => {
      const esConc = Boolean(item.fecha_elaboracion);
      const badge = esConc
        ? '<span class="badge bg-success"><i class="bi bi-check2-circle me-1"></i>Concluido</span>'
        : '<span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>Pendiente</span>';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="ps-3"><strong>${escapeHTML(item.num_oficio)}</strong></td>
        <td class="font-monospace">${escapeHTML(item.fecha_inicio)}</td>
        <td><strong>${escapeHTML(item.paciente_nombre)}</strong><br><small class="text-muted">${escapeHTML(item.cedula)}</small></td>
        <td>${escapeHTML(item.camillero_nombre)}</td>
        <td>${escapeHTML(item.hospital)}<br><small class="text-muted">${escapeHTML(item.ciudad)}</small></td>
        <td class="text-center">${badge}</td>
        <td class="text-center pe-3"><button type="button" class="btn btn-sm btn-guinda px-3 py-1" onclick="seleccionarModal(${item.id})">Seleccionar</button></td>
      `;
      tbody.appendChild(tr);
    });
    modalInstanceResultados.show();
  } catch (err) {
    alert('Error en búsqueda: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-search"></i> Buscar';
  }
}

function seleccionarModal(id) {
  modalInstanceResultados.hide();
  cargarRegistroPorId(id, false);
}

function bloquearCamposPorRol(esAdmin, esFase2, esFase1, esConsulta) {
  const fase1Inputs = document.querySelectorAll('#panel-salida input, #panel-salida select');
  const fase2Inputs = document.querySelectorAll('#panel-regreso input');
  fase1Inputs.forEach(el => { el.disabled = !esAdmin; });
  fase2Inputs.forEach(el => { el.disabled = !(esAdmin || esFase2); });
}

function llenarFormularioEdicion(res) {
  registroSeleccionadoActual = res;
  document.getElementById('btnReimprimirDirecto').classList.remove('d-none');

  const esAdmin = currentUser.role === 'Admin';
  const esFase2 = currentUser.role === 'Fase 2 (Cierre)';
  const esFase1 = currentUser.role === 'Fase 1 (Salida)';
  const esConsulta = currentUser.role === 'Consulta';

  const btnEjecutar = document.getElementById('btnEjecutar');
  if (esConsulta || esFase1) {
    new bootstrap.Tab(document.getElementById(esFase1 ? 'tab-salida' : 'tab-regreso')).show();
    cambiarFase(esFase1 ? 1 : 2);
    bloquearCamposPorRol(false, false, esFase1, esConsulta);
    btnEjecutar.classList.add('d-none');
  } else {
    new bootstrap.Tab(document.getElementById('tab-regreso')).show();
    cambiarFase(2);
    bloquearCamposPorRol(esAdmin, esFase2, false, false);
    btnEjecutar.classList.remove('d-none');
  }

  document.getElementById('registroId').value = res.id;
  document.getElementById('numOficio').value = res.num_oficio;
  document.getElementById('fechaOficio').value = res.fecha_oficio || '';
  document.getElementById('fechaOficioTexto').value = res.fecha_oficio_texto || '';

  asignarValorSelectRobusto('selectCamillero', res.camillero_nombre);
  document.getElementById('numEmpleado').value = res.num_empleado || '';
  document.getElementById('rfc').value = res.rfc_camillero || '';

  const pArr = String(res.paciente_nombre || '').trim().split(' ');
  if (pArr.length >= 3) {
    document.getElementById('pacienteMaterno').value = pArr.pop();
    document.getElementById('pacientePaterno').value = pArr.pop();
    document.getElementById('pacienteNombres').value = pArr.join(' ');
  } else {
    document.getElementById('pacienteNombres').value = res.paciente_nombre || '';
    document.getElementById('pacientePaterno').value = '';
    document.getElementById('pacienteMaterno').value = '';
  }

  document.getElementById('cedula').value = res.cedula || '';
  if (String(res.cedula || '').includes('/')) {
    const [rBase, pCode] = res.cedula.split('/');
    document.getElementById('rfcPacienteBase').value = rBase;
    document.getElementById('selectParentesco').value = pCode;
  } else {
    document.getElementById('rfcPacienteBase').value = res.cedula || '';
  }

  asignarValorSelectRobusto('selectHospital', res.hospital);
  document.getElementById('ciudad').value = res.ciudad || '';
  document.getElementById('fechaInicio').value = res.fecha_inicio || '';
  document.getElementById('fechaFin').value = res.fecha_fin || '';
  document.getElementById('intervaloFechas').value = res.intervalo_fechas || '';
  document.getElementById('fechaElaboracion').value = res.fecha_elaboracion || '';
  document.getElementById('factura').value = res.factura || '';
  document.getElementById('fechaFactura').value = res.fecha_factura || '';

  document.getElementById('ctxOficioYCamillero').textContent = `${res.num_oficio} | ${res.camillero_nombre}`;
  document.getElementById('ctxCamilleroDetalle').textContent = `No. Empleado: ${res.num_empleado} | RFC: ${res.rfc_camillero}`;
  document.getElementById('ctxPaciente').textContent = res.paciente_nombre;
  document.getElementById('ctxCedula').textContent = `Cédula / Exp: ${res.cedula}`;
  document.getElementById('ctxDestino').textContent = `${res.hospital} (${res.ciudad})`;
  document.getElementById('ctxFechas').textContent = res.intervalo_fechas;
  document.getElementById('bannerContextoActivo').classList.remove('d-none');

  document.querySelectorAll('#formComision input, #formComision select').forEach(evaluarCampo);
}

async function reimprimirActual() {
  if (!registroSeleccionadoActual) return;
  const tipo = registroSeleccionadoActual.fecha_elaboracion ? 'COMPLETO' : 'SOLO_VIATICOS';
  await generarYDescargarPDF(prepararParaPdf(registroSeleccionadoActual), tipo);
}

async function guardarYProcesar() {
  const idExistente = document.getElementById('registroId').value;
  if (!idExistente) {
    const form = document.getElementById('formComision');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const rfcBase = document.getElementById('rfcPacienteBase').value.trim();
    if (rfcBase && !validarEstructuraRfc10(rfcBase).valido) {
      alert('El RFC del paciente tiene un formato incorrecto.');
      return;
    }
  }

  const btn = document.getElementById('btnEjecutar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

  try {
    const tipoDoc = document.getElementById('tipoDocumento').value;
    const fIni = document.getElementById('fechaInicio').value;
    const fFin = document.getElementById('fechaFin').value;
    const fOfi = document.getElementById('fechaOficio').value;
    const fElab = document.getElementById('fechaElaboracion').value || null;
    const fFact = document.getElementById('fechaFactura').value || null;
    const pacCompleto = `${document.getElementById('pacienteNombres').value} ${document.getElementById('pacientePaterno').value} ${document.getElementById('pacienteMaterno').value}`.replace(/\s+/g, ' ').trim().toUpperCase();

    let idFinal = idExistente ? Number(idExistente) : null;

    if (!idFinal) {
      const { data, error } = await sb.rpc('crear_comision_fase1', {
        p_camillero_nombre: document.getElementById('selectCamillero').value,
        p_num_empleado: document.getElementById('numEmpleado').value,
        p_rfc_camillero: document.getElementById('rfc').value,
        p_fecha_oficio: fOfi,
        p_fecha_oficio_texto: document.getElementById('fechaOficioTexto').value,
        p_paciente_nombre: pacCompleto,
        p_cedula: document.getElementById('cedula').value.trim().toUpperCase(),
        p_hospital: document.getElementById('selectHospital').value,
        p_ciudad: document.getElementById('ciudad').value,
        p_fecha_inicio: fIni,
        p_fecha_fin: fFin,
        p_intervalo_fechas: document.getElementById('intervaloFechas').value.trim()
      });
      if (error) throw error;
      idFinal = data.id;
    } else if (currentUser.role === 'Admin') {
      const { error } = await sb.rpc('editar_comision_admin', {
        p_id: idFinal,
        p_camillero_nombre: document.getElementById('selectCamillero').value,
        p_num_empleado: document.getElementById('numEmpleado').value,
        p_rfc_camillero: document.getElementById('rfc').value,
        p_fecha_oficio: fOfi,
        p_fecha_oficio_texto: document.getElementById('fechaOficioTexto').value,
        p_paciente_nombre: pacCompleto,
        p_cedula: document.getElementById('cedula').value.trim().toUpperCase(),
        p_hospital: document.getElementById('selectHospital').value,
        p_ciudad: document.getElementById('ciudad').value,
        p_fecha_inicio: fIni,
        p_fecha_fin: fFin,
        p_intervalo_fechas: document.getElementById('intervaloFechas').value.trim(),
        p_fecha_elaboracion: fElab,
        p_fecha_elaboracion_texto: fElab ? fechaIsoATexto(fElab) : '',
        p_factura: document.getElementById('factura').value.trim(),
        p_fecha_factura: fFact,
        p_fecha_factura_texto: fFact ? fechaIsoATexto(fFact) : ''
      });
      if (error) throw error;
    } else {
      const { error } = await sb.rpc('cerrar_comision_fase2', {
        p_id: idFinal,
        p_fecha_elaboracion: fElab,
        p_fecha_elaboracion_texto: fElab ? fechaIsoATexto(fElab) : '',
        p_factura: document.getElementById('factura').value.trim(),
        p_fecha_factura: fFact,
        p_fecha_factura_texto: fFact ? fechaIsoATexto(fFact) : ''
      });
      if (error) throw error;
    }

    const { data: regActualizado } = await sb.from('comisiones').select('*').eq('id', idFinal).single();
    if (tipoDoc !== 'SOLO_GUARDAR' && regActualizado) {
      await generarYDescargarPDF(prepararParaPdf(regActualizado), tipoDoc);
    }

    document.getElementById('modalMensaje').innerHTML = `Se guardó correctamente en la base de datos.<br>Folio oficial: <b>${escapeHTML(regActualizado.num_oficio)}</b>`;
    document.getElementById('modalBotonera').innerHTML = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>`;
    modalInstanceConfirmacion.show();

    await cargarCatalogosServidor();
    limpiarFormulario();
  } catch (err) {
    alert('Error al guardar: ' + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-printer-fill me-1"></i> Procesar y descargar PDF';
  }
}

function limpiarFormulario() {
  document.getElementById('formComision').reset();
  document.getElementById('registroId').value = '';
  registroSeleccionadoActual = null;
  document.getElementById('btnReimprimirDirecto').classList.add('d-none');
  document.getElementById('bannerContextoActivo').classList.add('d-none');
  document.getElementById('errorRfcBase').classList.add('d-none');

  document.querySelectorAll('#formComision input, #formComision select').forEach(el => {
    el.disabled = false;
    el.classList.remove('campo-lleno', 'campo-error');
  });

  if (currentUser && currentUser.role !== 'Consulta') {
    document.getElementById('btnEjecutar').classList.remove('d-none');
  }
  if (currentUser && currentUser.role === 'Fase 2 (Cierre)') {
    new bootstrap.Tab(document.getElementById('tab-regreso')).show();
    cambiarFase(2);
  } else {
    new bootstrap.Tab(document.getElementById('tab-salida')).show();
    cambiarFase(1);
  }

  const hoy = new Date().toLocaleDateString('en-CA');
  document.getElementById('fechaOficio').value = hoy;
  actualizarTextoFechaOficio();
  document.getElementById('numOficio').value = sugerenciaOficioGlobal || '';
  evaluarCampo(document.getElementById('numOficio'));
}

// --- CATÁLOGOS, USUARIOS Y BITÁCORA ---
function cargarCatalogosAdmin() {
  const tbodyCam = document.getElementById('tablaCatCamilleros').querySelector('tbody');
  tbodyCam.innerHTML = '';
  personal.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHTML(c.nombre)}</strong></td><td>${escapeHTML(c.cargo)}</td>
      <td><span class="badge bg-light text-dark border font-monospace">${escapeHTML(c.num_empleado)}</span></td>
      <td><small class="font-monospace">${escapeHTML(c.rfc)}</small></td>
      <td class="text-center text-nowrap">
        <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="abrirModalCamillero(${c.id})"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="eliminarCamilleroAdmin(${c.id})"><i class="bi bi-trash"></i></button>
      </td>`;
    tbodyCam.appendChild(tr);
  });

  const tbodyHosp = document.getElementById('tablaCatHospitales').querySelector('tbody');
  tbodyHosp.innerHTML = '';
  destinos.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHTML(h.hospital)}</strong></td><td>${escapeHTML(h.ciudad)}</td>
      <td class="text-center text-nowrap">
        <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="abrirModalHospital(${h.id})"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="eliminarHospitalAdmin(${h.id})"><i class="bi bi-trash"></i></button>
      </td>`;
    tbodyHosp.appendChild(tr);
  });
}

function abrirModalCamillero(id) {
  const item = id ? personal.find(x => x.id === id) : null;
  document.getElementById('modalCamilleroTitulo').textContent = item ? 'Modificar camillero' : 'Registrar camillero';
  document.getElementById('catCamId').value = item ? item.id : '';
  document.getElementById('catCamNombre').value = item ? item.nombre : '';
  document.getElementById('catCamCargo').value = item ? item.cargo : 'CAMILLERO';
  document.getElementById('catCamNumEmp').value = item ? item.num_empleado : '';
  document.getElementById('catCamRfc').value = item ? item.rfc : '';
  modalInstanceCamillero.show();
}

async function guardarCamilleroAdmin(e) {
  e.preventDefault();
  const id = document.getElementById('catCamId').value;
  const payload = {
    nombre: document.getElementById('catCamNombre').value.trim().toUpperCase(),
    cargo: document.getElementById('catCamCargo').value.trim().toUpperCase(),
    num_empleado: document.getElementById('catCamNumEmp').value.trim(),
    rfc: document.getElementById('catCamRfc').value.trim().toUpperCase()
  };
  const { error } = id
    ? await sb.from('camilleros').update(payload).eq('id', Number(id))
    : await sb.from('camilleros').insert(payload);
  if (error) return alert('Error: ' + error.message);
  await sb.rpc('registrar_evento_admin', { p_folio: 'CATALOGO', p_accion: id ? 'EDICION_CAMILLERO' : 'ALTA_CAMILLERO', p_detalles: payload.nombre });
  modalInstanceCamillero.hide();
  await cargarCatalogosServidor();
}

async function eliminarCamilleroAdmin(id) {
  const c = personal.find(x => x.id === id);
  if (!confirm(`¿Desactivar al camillero "${c?.nombre}"?`)) return;
  await sb.from('camilleros').update({ activo: false }).eq('id', id);
  await sb.rpc('registrar_evento_admin', { p_folio: 'CATALOGO', p_accion: 'BAJA_CAMILLERO', p_detalles: c?.nombre || '' });
  await cargarCatalogosServidor();
}

function abrirModalHospital(id) {
  const item = id ? destinos.find(x => x.id === id) : null;
  document.getElementById('modalHospitalTitulo').textContent = item ? 'Modificar destino' : 'Registrar destino';
  document.getElementById('catHospId').value = item ? item.id : '';
  document.getElementById('catHospNombre').value = item ? item.hospital : '';
  document.getElementById('catHospCiudad').value = item ? item.ciudad : '';
  modalInstanceHospital.show();
}

async function guardarHospitalAdmin(e) {
  e.preventDefault();
  const id = document.getElementById('catHospId').value;
  const payload = {
    hospital: document.getElementById('catHospNombre').value.trim().toUpperCase(),
    ciudad: document.getElementById('catHospCiudad').value.trim().toUpperCase()
  };
  const { error } = id
    ? await sb.from('hospitales').update(payload).eq('id', Number(id))
    : await sb.from('hospitales').insert(payload);
  if (error) return alert('Error: ' + error.message);
  await sb.rpc('registrar_evento_admin', { p_folio: 'CATALOGO', p_accion: id ? 'EDICION_HOSPITAL' : 'ALTA_HOSPITAL', p_detalles: payload.hospital });
  modalInstanceHospital.hide();
  await cargarCatalogosServidor();
}

async function eliminarHospitalAdmin(id) {
  const h = destinos.find(x => x.id === id);
  if (!confirm(`¿Desactivar el destino "${h?.hospital}"?`)) return;
  await sb.from('hospitales').update({ activo: false }).eq('id', id);
  await sb.rpc('registrar_evento_admin', { p_folio: 'CATALOGO', p_accion: 'BAJA_HOSPITAL', p_detalles: h?.hospital || '' });
  await cargarCatalogosServidor();
}

async function asignarPerfilUsuarioAdmin(e) {
  e.preventDefault();
  const payload = {
    id: document.getElementById('usrUid').value.trim(),
    nombre_completo: document.getElementById('usrNombre').value.trim(),
    email: document.getElementById('usrEmail').value.trim().toLowerCase(),
    rol: document.getElementById('usrRol').value,
    estado: 'Activo'
  };
  const { error } = await sb.from('perfiles').upsert(payload);
  if (error) return alert('Error al guardar usuario: ' + error.message);
  await sb.rpc('registrar_evento_admin', { p_folio: 'N/A', p_accion: 'ALTA_USUARIO', p_detalles: `${payload.email} (${payload.rol})` });
  alert('Usuario asignado correctamente.');
  e.target.reset();
  cargarUsuariosAdmin();
}

async function cargarUsuariosAdmin() {
  const { data } = await sb.from('perfiles').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('tablaUsuariosAdmin').querySelector('tbody');
  tbody.innerHTML = '';
  (data || []).forEach(u => {
    const tr = document.createElement('tr');
    const esYo = u.id === currentUser.id;
    tr.innerHTML = `
      <td>${escapeHTML(u.nombre_completo)}</td>
      <td>${escapeHTML(u.email)}</td>
      <td>${escapeHTML(u.rol)}</td>
      <td><span class="badge ${u.estado === 'Activo' ? 'bg-success' : 'bg-danger'}">${escapeHTML(u.estado)}</span></td>
      <td><small>${u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('es-MX') : 'Sin ingreso'}</small></td>
      <td>${!esYo ? `<button class="btn btn-sm btn-outline-warning" onclick="alternarEstadoUsuario('${u.id}','${u.estado}')">${u.estado === 'Activo' ? 'Desactivar' : 'Activar'}</button>` : ''}</td>`;
    tbody.appendChild(tr);
  });
}

async function alternarEstadoUsuario(id, estadoActual) {
  const nuevo = estadoActual === 'Activo' ? 'Inactivo' : 'Activo';
  await sb.from('perfiles').update({ estado: nuevo }).eq('id', id);
  cargarUsuariosAdmin();
}

async function cargarTrazabilidad() {
  const crit = document.getElementById('inputBuscarBitacora').value.trim().toUpperCase();
  const { data } = await sb.from('trazabilidad').select('*').order('id', { ascending: false }).limit(100);
  const tbody = document.getElementById('tablaTrazabilidad').querySelector('tbody');
  tbody.innerHTML = '';
  (data || []).filter(t => !crit || `${t.folio} ${t.nombre_usuario} ${t.email} ${t.accion} ${t.detalles}`.toUpperCase().includes(crit))
    .slice(0, 50).forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-nowrap"><small class="font-monospace">${new Date(t.fecha_hora).toLocaleString('es-MX')}</small></td>
        <td><strong>${escapeHTML(t.folio)}</strong></td>
        <td>${escapeHTML(t.nombre_usuario)}<br><small class="text-muted">${escapeHTML(t.email)}</small></td>
        <td class="text-center"><span class="badge bg-secondary">${escapeHTML(t.accion)}</span></td>
        <td><small>${escapeHTML(t.detalles)}</small></td>`;
      tbody.appendChild(tr);
    });
}

// --- UTILIDADES VISUALES Y FECHAS ---
function configurarValidacionVisualYMayusculas() {
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', () => {
      if (el.type === 'text' && !el.readOnly && el.id !== 'usrUid' && el.id !== 'usrNombre') el.value = el.value.toUpperCase();
      evaluarCampo(el);
    });
    el.addEventListener('change', () => evaluarCampo(el));
  });
}

function evaluarCampo(el) {
  if (!el || ['inputBuscar','inputBuscarBitacora','filtroEstadoBusqueda','tipoDocumento','usrUid','usrNombre','usrEmail','usrRol'].includes(el.id)) return;
  if (el.value && String(el.value).trim() !== '') el.classList.add('campo-lleno');
  else el.classList.remove('campo-lleno');
}

function asignarValorSelectRobusto(selectId, valor) {
  const sel = document.getElementById(selectId);
  if (!sel || !valor) return;
  const b = String(valor).trim().toUpperCase();
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value.trim().toUpperCase() === b) { sel.selectedIndex = i; return; }
  }
}

function autoCompletarCamillero() {
  const nom = document.getElementById('selectCamillero').value;
  const cam = personal.find(p => p.nombre.trim().toUpperCase() === nom.trim().toUpperCase());
  document.getElementById('numEmpleado').value = cam ? cam.num_empleado : '';
  document.getElementById('rfc').value = cam ? cam.rfc : '';
  evaluarCampo(document.getElementById('numEmpleado'));
  evaluarCampo(document.getElementById('rfc'));
}

function autoCompletarHospital() {
  const hNom = document.getElementById('selectHospital').value;
  const h = destinos.find(d => d.hospital.trim().toUpperCase() === hNom.trim().toUpperCase());
  document.getElementById('ciudad').value = h ? h.ciudad : '';
  evaluarCampo(document.getElementById('ciudad'));
}

function validarEstructuraRfc10(rfc) {
  if (!rfc || rfc.length !== 10) return { valido: false, motivo: 'Debe tener exactamente 10 caracteres.' };
  const m = rfc.match(/^([A-ZÑ&]{4})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return { valido: false, motivo: 'Estructura incorrecta: 4 letras y 6 números.' };
  const mm = parseInt(m[3], 10), dd = parseInt(m[4], 10);
  if (mm < 1 || mm > 12) return { valido: false, motivo: 'Mes inválido (01 a 12).' };
  const dias = [31,29,31,30,31,30,31,31,30,31,30,31];
  if (dd < 1 || dd > dias[mm - 1]) return { valido: false, motivo: 'Día inválido para el mes.' };
  return { valido: true };
}

function validarYGenerarCedula() {
  const inputRfc = document.getElementById('rfcPacienteBase');
  const divError = document.getElementById('errorRfcBase');
  const par = document.getElementById('selectParentesco').value;
  const ced = document.getElementById('cedula');
  inputRfc.value = inputRfc.value.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '');
  const v = inputRfc.value;
  if (!v) { inputRfc.classList.remove('campo-lleno','campo-error'); divError.classList.add('d-none'); ced.value = ''; return; }
  if (v.length === 10) {
    const chk = validarEstructuraRfc10(v);
    if (chk.valido) {
      inputRfc.classList.remove('campo-error'); inputRfc.classList.add('campo-lleno');
      divError.classList.add('d-none');
      ced.value = par ? `${v}/${par}` : v;
      evaluarCampo(ced);
    } else {
      inputRfc.classList.remove('campo-lleno'); inputRfc.classList.add('campo-error');
      divError.textContent = chk.motivo; divError.classList.remove('d-none');
    }
  }
}

function fechaIsoATexto(iso) {
  if (!iso || iso.indexOf('-') === -1) return '';
  const [a, m, d] = iso.split('-');
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${a}`;
}

function actualizarTextoFechaOficio() {
  const el = document.getElementById('fechaOficio');
  document.getElementById('fechaOficioTexto').value = fechaIsoATexto(el.value);
  evaluarCampo(el);
  evaluarCampo(document.getElementById('fechaOficioTexto'));
}

function calcularFechasComision() {
  const f1 = document.getElementById('fechaInicio').value;
  const f2 = document.getElementById('fechaFin').value;
  const camp = document.getElementById('intervaloFechas');
  if (!f1 && !f2) { camp.value = ''; return; }
  if (f1 && !f2) { camp.value = fechaIsoATexto(f1).toUpperCase(); return; }
  const [a1,m1,d1] = f1.split('-').map(Number);
  const [a2,m2,d2] = f2.split('-').map(Number);
  if (a1===a2 && m1===m2 && d1===d2) camp.value = `${String(d1).padStart(2,'0')} DE ${MESES[m1-1].toUpperCase()} DE ${a1}`;
  else if (a1===a2 && m1===m2) camp.value = `${String(d1).padStart(2,'0')} AL ${String(d2).padStart(2,'0')} DE ${MESES[m1-1].toUpperCase()} DE ${a1}`;
  else if (a1===a2) camp.value = `${String(d1).padStart(2,'0')} DE ${MESES[m1-1].toUpperCase()} AL ${String(d2).padStart(2,'0')} DE ${MESES[m2-1].toUpperCase()} DE ${a1}`;
  else camp.value = `${String(d1).padStart(2,'0')} DE ${MESES[m1-1].toUpperCase()} DE ${a1} AL ${String(d2).padStart(2,'0')} DE ${MESES[m2-1].toUpperCase()} DE ${a2}`;
  evaluarCampo(camp);
}

// --- RESPALDO E IMPORTADOR CSV ---
async function exportarTablaCSV(tabla) {
  const { data, error } = await sb.from(tabla).select('*').order('id', { ascending: true });
  if (error || !data || data.length === 0) return alert('Sin datos para exportar.');
  const cols = Object.keys(data[0]);
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [cols.map(esc).join(','), ...data.map(r => cols.map(c => esc(r[c])).join(','))];
  const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `respaldo_${tabla}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function parseCSV(text) {
  const rows = []; let row = []; let val = ''; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i+1];
    if (inQuotes) {
      if (c === '"' && n === '"') { val += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else val += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(val); val = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && n === '\n') i++;
        row.push(val); rows.push(row); row = []; val = '';
      } else val += c;
    }
  }
  if (val || row.length) { row.push(val); rows.push(row); }
  return rows;
}

function parseFechaFlexibleAIso(txt) {
  if (!txt) return null;
  const t = String(txt).trim().toLowerCase();
  let m = t.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/);
  if (m) {
    const idx = MESES.indexOf(m[2]) + 1;
    if (idx > 0) return `${m[3]}-${String(idx).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  return null;
}

async function importarCsvCamilleros() {
  const file = document.getElementById('csvCamillerosFile').files[0];
  if (!file) return alert('Selecciona primero el archivo camilleros.csv');
  const rows = parseCSV(await file.text());
  let cntCam = 0, cntHosp = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const nom = (r[1] || '').trim().toUpperCase();
    if (nom && nom !== 'NOMBRE' && nom !== 'TABLA_1') {
      await sb.from('camilleros').insert({ nombre: nom, cargo: (r[2]||'CAMILLERO').trim().toUpperCase(), num_empleado: (r[3]||'').trim(), rfc: (r[4]||'').trim().toUpperCase() });
      cntCam++;
    }
    const hosp = (r[6] || '').trim().toUpperCase();
    if (hosp && hosp !== 'HOSPITAL' && hosp !== 'TABLA_2') {
      await sb.from('hospitales').insert({ hospital: hosp, ciudad: (r[7]||'').trim().toUpperCase() });
      cntHosp++;
    }
  }
  const log = document.getElementById('logImportacion');
  log.classList.remove('d-none');
  log.textContent = `Importación terminada: ${cntCam} camilleros y ${cntHosp} hospitales cargados.`;
  await cargarCatalogosServidor();
}

async function importarCsvBD() {
  const file = document.getElementById('csvBdFile').files[0];
  if (!file) return alert('Selecciona primero el archivo BD.csv');
  const rows = parseCSV(await file.text());
  let ok = 0, omitidos = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const oficio = (r[1] || '').trim();
    const m = oficio.match(/(\d+)(?:-T)?\/(\d{4})/i);
    if (!oficio || !m) { omitidos++; continue; }
    const fIni = parseFechaFlexibleAIso(r[18]) || parseFechaFlexibleAIso(r[13]) || parseFechaFlexibleAIso(r[9]);
    const fFin = parseFechaFlexibleAIso(r[19]) || parseFechaFlexibleAIso(r[14]) || fIni;
    const fOfi = parseFechaFlexibleAIso(r[9]) || fIni;
    if (!fIni || !fOfi) { omitidos++; continue; }
    const fElab = parseFechaFlexibleAIso(r[17]);
    const fFact = parseFechaFlexibleAIso(r[16]);
    const { error } = await sb.rpc('importar_comision_historica', {
      p_num_oficio: oficio,
      p_consecutivo: parseInt(m[1], 10),
      p_anio: parseInt(m[2], 10),
      p_camillero_nombre: r[7] || '',
      p_num_empleado: r[2] || '',
      p_rfc_camillero: r[3] || r[8] || '',
      p_fecha_oficio: fOfi,
      p_fecha_oficio_texto: r[9] || fechaIsoATexto(fOfi),
      p_paciente_nombre: r[10] || '',
      p_cedula: r[11] || '',
      p_hospital: r[12] || '',
      p_ciudad: r[4] || '',
      p_fecha_inicio: fIni,
      p_fecha_fin: fFin,
      p_intervalo_fechas: r[34] || `${r[13] || ''} AL ${r[14] || ''}`,
      p_fecha_elaboracion: fElab,
      p_fecha_elaboracion_texto: r[17] || null,
      p_factura: r[15] || '',
      p_fecha_factura: fFact,
      p_fecha_factura_texto: r[16] || null
    });
    if (!error) ok++; else omitidos++;
  }
  const log = document.getElementById('logImportacion');
  log.classList.remove('d-none');
  log.textContent = `Migración BD completada: ${ok} traslados importados, ${omitidos} filas vacías o duplicadas omitidas.`;
  await cargarCatalogosServidor();
}
