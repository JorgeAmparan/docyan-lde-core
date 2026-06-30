"""
Tests de los 8 pipelines de resolución (B8 §A2).

Cada pipeline navega un reader sintético y produce un payload Pydantic válido;
se verifican además los cruces estructurales más usados (doc 03):
T2→T1, T5→T2, T7→T2, T5→T6.
"""
from app.orchestrator.clasificacion.tipos import TipoIntencion
from app.pipelines.base import ContextoPipeline
from app.pipelines.registry import resolver_para


class FakeReader:
    def informativa(self, t, term, e, d=None):
        return {"especificaciones": [
            {"nombre": "Presión", "valor": "40", "unidad": "Nm",
             "documento_id": "d1", "documento_nombre": "NOM-052", "seccion": "5", "pagina": 3},
            {"nombre": "Presión máx", "valor": "60", "unidad": "Nm"},
        ], "termino": "Presión", "definicion": "fuerza por unidad de área"}

    def procedimiento(self, t, term, e, d=None):
        return {"procedimiento_id": "p1", "titulo": "Montaje", "pasos": [
            {"orden": 2, "descripcion": "apretar", "epp": ["guantes"], "herramientas": ["llave"],
             "advertencias": ["cuidado"], "precondiciones": [], "postcondiciones": []},
            {"orden": 1, "descripcion": "limpiar", "epp": [], "herramientas": [],
             "advertencias": [], "precondiciones": ["equipo apagado"], "postcondiciones": []},
        ]}

    def recurso_visual(self, t, term, e, d=None):
        return {"recurso_id": "r1", "titulo": "Tablero", "recurso_url": "http://x/img.png",
                "etiquetas": [{"texto": "Q1", "x": 0.1, "y": 0.2}],
                "leyenda": [{"simbolo": "⏚", "significado": "tierra"}]}

    def video(self, t, term, e, d=None):
        return {"recurso_id": "v1", "titulo": "Montaje", "video_url": "http://x/v.mp4",
                "capitulos": [{"titulo": "Intro", "inicio_seg": 0}],
                "subtitulos": [{"idioma": "es", "texto": "hola", "inicio_seg": 0, "fin_seg": 2}],
                "transcripcion": "transcripción completa", "par_activo": "es"}

    def arbol_diagnostico(self, t, term, e, n, d=None):
        return {"arbol_id": "a1", "titulo": "No enciende", "nodo_actual_id": "n1",
                "pregunta": "¿hay energía?", "opciones": [
                    {"etiqueta": "no", "siguiente_nodo_id": "n2"},
                    {"etiqueta": "sí", "siguiente_nodo_id": "n3"}]}

    def historial(self, t, e):
        return {
            "eventos": [
                {"tipo": "consulta_realizada", "descripcion": "par de apriete", "ts": "2026-05-01"},
                {"tipo": "consulta_realizada", "descripcion": "par de apriete", "ts": "2026-05-02"},
                {"tipo": "troubleshooting", "descripcion": "no encendía", "ts": "2026-05-03"},
            ],
            "certificados": [{"tipo": "certificado", "descripcion": "calibración", "ts": "2026-04-01"}],
            "observaciones": [{"descripcion": "ruido anómalo", "ts": "2026-05-04"}],
            "mediciones": [{"descripcion": "12.3 V", "ts": "2026-05-05"}],
        }

    def alertas(self, t, e):
        return [
            {"alerta_id": "al1", "descripcion": "certificado por vencer", "urgencia": "alta"},
            {"alerta_id": "al2", "descripcion": "administre 5 mg de medicamento", "urgencia": "alta"},
        ]

    def comparar(self, t, est, i, d):
        return {"izquierda": {"version": "1", "hash": "aaa"},
                "derecha": {"version": "2", "hash": "bbb"}}

    def bilingue(self, t, term, src="en-US", tgt="es-MX"):
        return {
            "par_linguistico": "en-US → es-MX",
            "desde_memoria": True,
            "lock_activo": True,
            "segmentos": [
                {"texto_origen": "Stop the machine and apply lock-out/tag-out before service.",
                 "texto_destino": "Detén la máquina y aplica bloqueo/etiquetado (LOTO) antes del servicio.",
                 "idioma_origen": "en-US", "idioma_destino": "es-MX",
                 "tipo_segmento": "advertencia",
                 "lock": [{"termino_origen": "lock-out/tag-out", "termino_destino": "bloqueo/etiquetado (LOTO)"}],
                 "documento_nombre": "Memoria de traducción", "documento_tipo": "memoria_traduccion",
                 "seccion": "seguridad", "fragmento": "Stop the machine and apply lock-out/tag-out before service."},
                {"texto_origen": "The housing remains pressurized until fully drained.",
                 "texto_destino": "El alojamiento permanece presurizado hasta drenarse por completo.",
                 "idioma_origen": "en-US", "idioma_destino": "es-MX",
                 "tipo_segmento": "narrativa", "lock": [],
                 "documento_nombre": "Memoria de traducción", "documento_tipo": "memoria_traduccion",
                 "seccion": "operacion", "fragmento": "The housing remains pressurized until fully drained."},
            ],
        }

    def bilingue_vacia(self):
        return {"par_linguistico": "en-US → es-MX", "segmentos": [], "desde_memoria": False, "lock_activo": False}


def _ctx(**kw):
    base = dict(tenant_id="t1", pregunta="q", entidad_id="e1",
                params={"ref_izquierda": "A", "ref_derecha": "B", "estrategia": "versiones_documento"})
    base.update(kw)
    return ContextoPipeline(**base)


def test_tipo1_informativa_payload_y_desambiguacion():
    res = resolver_para(TipoIntencion.INFORMATIVA)(_ctx(), FakeReader())
    p = res.payload
    assert p.kind == "info_card"
    assert p.match_multiple is True
    assert len(p.especificaciones) == 2
    assert p.especificaciones[0].cita.documento_nombre == "NOM-052"
    p.model_validate(p.model_dump())


def test_tipo2_pasos_ordenados_y_cruce_a_tipo1():
    res = resolver_para(TipoIntencion.GUIA_PASO_A_PASO)(_ctx(), FakeReader())
    p = res.payload
    assert p.kind == "procedure_card"
    assert [x.orden for x in p.pasos] == [1, 2]  # reordenados por 'orden'
    # Cruce estructural T2 → T1 (especificación referenciada).
    assert any(c.tipo_intencion == "INFORMATIVA" for c in res.cruces)


def test_tipo3_diagrama_con_etiquetas_y_leyenda():
    res = resolver_para(TipoIntencion.GRAFICOS_DIAGRAMAS)(_ctx(), FakeReader())
    p = res.payload
    assert p.kind == "diagram_viewer"
    assert p.etiquetas[0].texto == "Q1"
    assert p.leyenda_simbolica[0].significado == "tierra"


def test_tipo4_video_bandera_subtitulos_honesta():
    res = resolver_para(TipoIntencion.VIDEO)(_ctx(params={"par_linguistico": "es"}), FakeReader())
    p = res.payload
    assert p.kind == "video_player"
    assert p.subtitulos_disponibles_en_par_activo is True
    # Sin par activo coincidente → bandera False (honesta).
    res2 = resolver_para(TipoIntencion.VIDEO)(_ctx(params={"par_linguistico": "en"}), FakeReader())
    assert res2.payload.subtitulos_disponibles_en_par_activo is False


def test_tipo5_troubleshooting_cruces_a_tipo2_y_tipo6():
    res = resolver_para(TipoIntencion.TROUBLESHOOTING)(_ctx(), FakeReader())
    p = res.payload
    assert p.kind == "diagnostic_tree"
    assert len(p.opciones) == 2
    destinos = {c.tipo_intencion for c in res.cruces}
    assert "GUIA_PASO_A_PASO" in destinos  # T5 → T2
    assert "HISTORIAL" in destinos          # T5 → T6


def test_tipo6_historial_incluye_patrones_edb():
    res = resolver_para(TipoIntencion.HISTORIAL)(_ctx(), FakeReader())
    p = res.payload
    assert p.kind == "timeline"
    assert "par de apriete" in p.patrones_edb.consultas_frecuentes
    assert p.patrones_edb.problemas_recurrentes  # troubleshooting recurrente
    assert "ruido anómalo" in p.patrones_edb.observaciones_acumuladas


def test_tipo7_alertas_filtra_no_administrativas_y_cruce_a_tipo2():
    ctx = _ctx()
    res = resolver_para(TipoIntencion.ALERTAS)(ctx, FakeReader())
    p = res.payload
    assert p.kind == "alerts_dashboard"
    assert p.solo_administrativas is True
    # La alerta clínica fue cuarentenada; solo se sirve la administrativa.
    assert len(p.alertas) == 1
    assert p.alertas[0].alerta_id == "al1"
    assert len(ctx.params["_alertas_cuarentena"]) == 1
    assert any(c.tipo_intencion == "GUIA_PASO_A_PASO" for c in res.cruces)  # T7 → T2


def test_tipo8_comparativa_detecta_diferencias_de_seguridad():
    res = resolver_para(TipoIntencion.COMPARATIVA)(_ctx(), FakeReader())
    p = res.payload
    assert p.kind == "comparative_view"
    assert p.estrategia == "versiones_documento"
    campos = {d.campo for d in p.diferencias}
    assert "version" in campos and "hash" in campos
    assert any(d.es_cambio_seguridad for d in p.diferencias)


def test_tipo9_bilingue_segmentos_alineados_y_lock_y_cita():
    res = resolver_para(TipoIntencion.BILINGUE)(_ctx(), FakeReader())
    p = res.payload
    assert p.kind == "bilingual_alignment"
    assert p.desde_memoria is True
    assert p.par_linguistico == "en-US → es-MX"
    assert len(p.segmentos) == 2
    # Segmento origen verbatim (EN) ↔ destino (ES) + lock terminológico fijado.
    seg = p.segmentos[0]
    assert seg.idioma_origen == "en-US" and seg.idioma_destino == "es-MX"
    assert "lock-out/tag-out" in seg.texto_origen
    assert seg.lock[0].termino_destino == "bloqueo/etiquetado (LOTO)"
    assert p.lock_terminologico_activo is True
    # Cita = fragmento verbatim del segmento origen (integridad de cita).
    assert seg.cita is not None and seg.cita.fragmento == seg.texto_origen
    assert len(p.citas) >= 1
    # Cruce estructural T9 → T1.
    assert any(c.tipo_intencion == "INFORMATIVA" for c in res.cruces)
    p.model_validate(p.model_dump())


def test_tipo9_bilingue_sin_memoria_es_honesto():
    """Sin memoria para el par → payload vacío VÁLIDO + desde_memoria=False (no finge)."""
    class SinMemoria(FakeReader):
        def bilingue(self, t, term, src="en-US", tgt="es-MX"):
            return self.bilingue_vacia()

    res = resolver_para(TipoIntencion.BILINGUE)(_ctx(), SinMemoria())
    p = res.payload
    assert p.kind == "bilingual_alignment"
    assert p.desde_memoria is False
    assert p.segmentos == []
    assert p.citas == []
