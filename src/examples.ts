/**
 * A realistic before/after Pet Store pair used by the "Load example" action so
 * the wow moment is reachable in one click. The new spec deliberately contains a
 * mix of breaking changes (removed operation, new required param, dropped
 * response field, narrowed enum) and safe ones (new path, new optional field).
 */

export const EXAMPLE_OLD = `openapi: 3.0.3
info:
  title: Pet Store
  version: 1.0.0
paths:
  /pets:
    get:
      parameters:
        - name: limit
          in: query
          required: false
          schema: { type: integer }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                required: [id, name, status]
                properties:
                  id: { type: integer }
                  name: { type: string }
                  status:
                    type: string
                    enum: [available, pending, sold]
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string }
  /pets/{id}:
    get:
      responses:
        '200': { description: ok }
    delete:
      responses:
        '204': { description: deleted }
`;

export const EXAMPLE_NEW = `openapi: 3.0.3
info:
  title: Pet Store
  version: 2.0.0
paths:
  /pets:
    get:
      parameters:
        - name: limit
          in: query
          required: false
          schema: { type: integer }
        - name: tag
          in: query
          required: true
          schema: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                required: [id, name]
                properties:
                  id: { type: integer }
                  name: { type: string }
                  status:
                    type: string
                    enum: [available, sold]
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string }
                photoUrl: { type: string }
  /pets/{id}:
    get:
      responses:
        '200': { description: ok }
  /stores:
    get:
      responses:
        '200': { description: ok }
`;
