var pantallaOperacion = document.getElementById("operacion");
var pantallaNumero = document.getElementById("numero");

var numeroActual = "";
var numeroAnterior = "";

var operadorElegido = null;
var empezarNuevo = false;
var contextoAudio = null;

function actualizarPantalla(){
    if (numeroActual === ""){
        pantallaNumero.textContent = "0";
    }else{
        pantallaNumero.textContent = numeroActual;
    }

    if (pantallaOperacion.textContent === ""){
        pantallaOperacion.textContent = "0";
    }
    
}

function escribirNumero(digito){
    if (empezarNuevo === true){
        numeroActual = "";
        empezarNuevo = false;
    }
    if (numeroActual.length >= 12){
    return; 
}

if (numeroActual === "0" && digito === "0"){
    return;
}

if (numeroActual === "0" && digito !== "0"){
    numeroActual = digito;
 }else {
    numeroActual = numeroActual + digito;

}

actualizarPantalla();
}

function escribirPunto(){
    if (empezarNuevo === true){
        numeroActual = "0";
    empezarNuevo = false;
    }

    if (numeroActual.includes(".")){
    return;

    }

    if (numeroActual === ""){
    numeroActual = "0.";
    } else {
    numeroActual = numeroActual + ".";
    }

    actualizarPantalla();
}

function elegirOperador(operador){
    if (numeroActual === "" && numeroAnterior === ""){
        return;
    }

    if (numeroActual === "" && numeroAnterior !== "" && operadorElegido !== null){
        calcularResultado();
    }

    if (numeroActual !== ""){
        numeroAnterior = numeroActual;
    }

    operadorElegido = operador;

    numeroActual = "";
    empezarNuevo = false

    resaltarOperador(operador);

    var simbolo = obtenerSimbolo(operador);
    pantallaOperacion.textContent = numeroAnterior + " " + simbolo;

    actualizarPantalla();
}

function calcularResultado(){
    if (numeroAnterior === "" || numeroActual === "" || operadorElegido === null){
        return;
    }

    var numA = parseFloat(numeroAnterior);
    var numB = parseFloat(numeroActual);

    var resultado;

    var simbolo = obtenerSimbolo(operadorElegido);
    pantallaOperacion.textContent = numA + " " + simbolo + " " + numB + " =";
    
    if (operadorElegido === "+"){
        resultado = numA + numB;
    }

    if (operadorElegido === "-"){
        resultado = numA - numB;
    }

    if (operadorElegido === "*"){
        resultado = numA * numB;
    }

    if (operadorElegido === "/"){
        if (numB === 0){
            mostrarError("No se puede dividir entre cero");
            return;
        }
        resultado = numA / numB;
    }
    resultado = parseFloat(resultado.toPrecision(10));

    numeroActual = resultado.toString();

    numeroAnterior = "";
    operadorElegido = null;

    empezarNuevo = true;

    quitarResaltadoOperadores();

    animarResultado();

    actualizarPantalla();
}

function limpiarTodo(){
    numeroActual = "";
    numeroAnterior = "";
    operadorElegido = null;
    empezarNuevo = false;

    pantallaOperacion.textContent = 0;

    quitarResaltadoOperadores();
    actualizarPantalla();
}

function borrarUltimo(){
    if (empezarNuevo === true){
        return;
        }
        numeroActual = numeroActual.slice(0, -1);

        actualizarPantalla();

    
}

function cambiarSigno(){
    if (numeroActual === "" || numeroActual === "0"){
        return;
    }

    if (numeroActual.startsWith("-")){
        numeroActual = numeroActual.slice(1);
    }else{
        numeroActual = "-" + numeroActual;
    }
    actualizarPantalla();
}

function calcularPorcentaje(){
    if (numeroActual === ""){
        return;
    }
    var numero = parseFloat(numeroActual);
    var resultado = numero / 100;

    pantallaOperacion.textContent = numero + "%";
    numeroActual = resultado.toString();

    animarResultado();
    actualizarPantalla();
}

function calcularRaiz(){
    if (numeroActual === ""){
        return;
    }
    var numero = parseFloat(numeroActual);

    if (numero < 0) {
        mostrarError("Error: Raiz de negativo");
        return;
    }
    var resultado = Math.sqrt(numero);

    pantallaOperacion.textContent = "√(" + numero + ")";
    numeroActual = parseFloat(resultado.toPrecision(10)).toString();

    animarResultado();
    actualizarPantalla();
}

function calcularCuadrado(){
    if (numeroActual === ""){
        return;
    }

    var numero = parseFloat(numeroActual);
    var resultado = Math.pow(numero, 2);

    pantallaOperacion.textContent = "(" + numero + ")²";
    numeroActual = parseFloat(resultado.toPrecision(10)).toString();

    animarResultado();
    actualizarPantalla();
}

function calcularLogaritmo(){
    if (numeroActual === ""){
        return;
    }

    var numero = parseFloat(numeroActual);

    if (numero <= 0) {
        mostrarError("Error: Log de <= 0");
        return;
    }

    var resultado = Math.log10(numero);
    pantallaOperacion.textContent = "log(" + numero + ")";
    numeroActual = resultado.toString();
    animarResultado();
    actualizarPantalla();
}

function obtenerSimbolo(operador){
    if (operador === "+") return "+";
    if (operador === "-") return "-";
    if (operador === "*") return "×";
    if (operador === "/") return "÷";
    return "";
    
}

actualizarPantalla();


document.addEventListener("keydown", function(evento) {
    var tecla = evento.key;

    if (tecla >= "0" && tecla <= "9") escribirNumero(tecla);

    if (tecla === ".") escribirPunto();

    if (tecla === "+") elegirOperador("+");
    if (tecla === "-") elegirOperador("-");
    if (tecla === "*") elegirOperador("*");
    if (tecla === "/") {
      evento.preventDefault();
      elegirOperador("/");
    }
    
     if (tecla === "Enter" || tecla === "=") {
             calcularResultado();
    }

    if (tecla === "Backspace") {
      borrarUltimo();
    }

        if (tecla === "Escape") {
      limpiarTodo();
    }

    
});

function mostrarError(mensaje) {
    pantallaOperacion.textContent = mensaje;
    pantallaNumero.textContent = "Error";
    pantallaNumero.classList.add("error");
    numeroActual = "";
    numeroAnterior = "";
    operadorElegido = null;
    empezarNuevo = true;
    quitarResaltadoOperadores();
}

function resaltarOperador(operador) {
    quitarResaltadoOperadores();
    document.querySelectorAll(".key-op").forEach(function(boton) {
        if (boton.getAttribute("onclick").includes("'" + operador + "'")) {
            boton.classList.add("selected");
        }
    });
}

function quitarResaltadoOperadores() {
    document.querySelectorAll(".key-op.selected").forEach(function(boton) {
        boton.classList.remove("selected");
    });
}

function animarResultado(){
    pantallaNumero.classList.remove("error");
    pantallaNumero.classList.add("resultado-animacion");
    reproducirSonidoResultado();
    setTimeout(function() {
        pantallaNumero.classList.remove("resultado-animacion");
    }, 500);
}

actualizarPantalla();