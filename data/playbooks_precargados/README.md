# Playbooks precargados por vertical

Librería de plantillas que **B13 (onboarding)** carga durante el alta de un
cliente para sembrar Playbooks del vertical (laboratorio, maquiladora, agencia…).

**Vacío en B8 a propósito** (alcance declarado): B8 expone la mecánica de seed
(`app/playbooks/seed_vertical.py` + `POST /mo/playbooks/seed_for_vertical`); B13
llena estos JSON con el conocimiento curado por Jorge.

## Formato

Un archivo `<vertical>.json` por vertical, con una lista de plantillas:

```json
[
  {
    "nombre": "Apertura de turno - Laboratorio ISO 17025",
    "descripcion": "Recorrido de verificación al iniciar el turno",
    "pasos": [
      {
        "nombre": "Calibraciones por vencer",
        "consulta_original": "¿Qué equipos tienen calibración por vencer?",
        "tipo_intencion": "ALERTAS",
        "entidad_referenciada_id": null,
        "tipo_documento_origen": "calibracion",
        "nota_paso": "Revisar antes de operar"
      }
    ]
  }
]
```

`tipo_intencion` ∈ los 8 tipos del clasificador (B8). Si `entidad_referenciada_id`
es `null`, la consulta se resuelve sin entidad fija (consulta amplia del tenant).
