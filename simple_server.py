#!/usr/bin/env python3

from flask import Flask, jsonify, render_template_string

app = Flask(__name__)

# Template HTML simple
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>STEL Shop Manager</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { padding: 20px; border-radius: 5px; margin: 10px 0; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 STEL Shop Manager - Servidor de Prueba</h1>
        
        <div class="status success">
            ✅ Servidor Flask funcionando correctamente
        </div>
        
        <div class="status info">
            📡 Puerto: 5001<br>
            🌐 URL: http://localhost:5001<br>
            ⏰ Estado: Activo
        </div>
        
        <h2>Endpoints Disponibles:</h2>
        <ul>
            <li><a href="/health">/health</a> - Estado del servidor</li>
            <li><a href="/test">/test</a> - Prueba de conectividad</li>
        </ul>
        
        <div class="status info">
            <strong>Nota:</strong> Este es un servidor de prueba simplificado. 
            Una vez que confirmes que funciona, podremos activar el servidor completo.
        </div>
    </div>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'message': 'Servidor funcionando correctamente',
        'port': 5001
    })

@app.route('/test')
def test():
    return jsonify({
        'test': 'success',
        'message': 'Conectividad confirmada'
    })

if __name__ == '__main__':
    print("🚀 Iniciando servidor de prueba...")
    print("📡 URL: http://localhost:5001")
    print("🔄 Presiona Ctrl+C para detener")
    
    app.run(debug=True, host='0.0.0.0', port=5001)
