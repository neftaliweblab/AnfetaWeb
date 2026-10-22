# Calendario individual del buscador — 21 octubre 2026

## Comportamiento

- Se amplía automáticamente la primera actividad cronológica sin terminar, excluyendo copias de revisión e históricas de la selección automática.
- Las terminadas siguen visibles y pueden consultarse manualmente; si todas están terminadas, no se abre una por defecto.
- Una tarjeta ampliada a la vez. Cerrar contrae su detalle; seleccionar otra cambia el checklist consultado.
- El detalle reutiliza CalendarDetailPanel en modo integrado: checklist real editable según permisos, progreso, actividades del proyecto y acceso a Notion.
- Colores del calendario: pendiente ámbar, terminada verde con título atenuado/tachado, revisión azul, suspendida violeta y urgencia roja. Una terminada conserva su identificación de terminada aunque el título tenga un tag urgente antiguo.
- Botón de tres puntos y clic derecho: reasignar, enviar a revisión, finalizar, editar fecha/hora y mover día/duración. Se reutilizan las modales de equipo y QuickScheduleActions.
- Se mantienen los permisos, el revisor asignado, las copias de solo lectura, las fechas históricas y las comprobaciones del servidor.
- Revisiones y reasignaciones verifican primero la actividad actual. Un cambio real pide revisar y confirmar otra vez; los estados no se adelantan antes de la confirmación.
- Las acciones con soporte offline conservan la presentación del servidor hasta la confirmación. Se impiden envíos simultáneos desde el panel.
- Actualización ligera cada 30 segundos y por eventos/foco; no se solapan lecturas periódicas ni se consultan todos los checklists de la lista.
- Un guardado confirmado se comunica a las otras vistas mediante el canal existente. Se filtran eliminaciones ya confirmadas y se conservan temporalmente guardados recientes frente a lecturas anteriores.
- Se agregan accesos de Acalli y Brian a los integrantes existentes. No se agregan proveedores, planes ni cambios de infraestructura.

## Validación

- scripts/personal-agenda-regression.test.cjs: selección/orden, estados, preflight, payloads, permisos, errores y resultados pendientes offline.
- scripts/agenda-actions-regression.test.cjs: modales reutilizadas, permisos, finalizar, revisor asignado, bloqueos por estado y durante guardado.
- scripts/deletion-review-regression.test.cjs: pasó.
- TypeScript: pasó.
- npm run test:calendar: 75 casos pasaron, con peticiones a Notion simuladas.
- Turbopack falló al iniciar el proceso de CSS; next build --webpack completó correctamente la compilación de producción.
- La prueba ya existente scripts/quick-assignee-select.test.cjs falla esperando que Neftali deje de ver un selector después de transferir a John. El componente existente permite a dirección conservar el selector y actualmente tiene reglas de revisión distintas de esa prueba. No se modificaron ese componente ni su prueba en este cambio.

Sin despliegue ni escrituras de prueba en Notion. Falta validar visualmente con una sesión autenticada y datos reales.
