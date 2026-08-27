(function () {
  function descriptionFor(product) {
    const name = String(product.name || "Este producto").trim();
    const subcategory = String(product.subcategory || "");
    const mineralIngredient = /arcilla|caol[ií]n|bentonita|barro|mineral|carb[oó]n|sal\b/i.test(name);
    const descriptions = {
      "Aceites Esenciales": `${name} es un aceite esencial aromático para formulaciones cosméticas y preparaciones artesanales compatibles. Debe incorporarse en la proporción adecuada, normalmente diluido, y conviene realizar una prueba pequeña antes de preparar un lote completo.`,
      "Aromas": `${name} es un aroma concentrado para perfumar jabones y otras creaciones artesanales compatibles. Añádelo poco a poco hasta alcanzar la intensidad deseada; el resultado puede variar según la base, la temperatura y la cantidad utilizada.`,
      "Bases de Jabón de Glicerina": `${name} es una base de jabón de glicerina lista para fundir, personalizar y moldear. Puede combinarse con colorantes, aromas y aditivos compatibles, evitando el sobrecalentamiento para conservar una textura uniforme.`,
      "Colorantes Líquidos": `${name} es un colorante líquido concentrado para dar tonalidad a jabones y formulaciones compatibles. Se recomienda añadirlo gota a gota y realizar una prueba previa, ya que el tono final puede variar según la base y la concentración.`,
      "Deshidratados": `${name} es un ingrediente deshidratado para decoración, maceraciones y preparaciones artesanales compatibles. Su apariencia, tamaño y color pueden variar de forma natural entre lotes.`,
      "Glitter": `${name} es un aditivo decorativo para aportar brillo a creaciones artesanales compatibles. Utiliza una cantidad pequeña y comprueba previamente su comportamiento en la base elegida.`,
      "Micas": `${name} es una mica en polvo para aportar color y efecto perlado a jabones, cosméticos y otras preparaciones compatibles. Dispersa una pequeña cantidad antes de incorporarla; el tono puede variar según la base y la dosis.`,
      "Moldes para Jabón": `${name} es un molde reutilizable para dar forma a jabones artesanales. Colócalo sobre una superficie estable, evita temperaturas superiores a las recomendadas para su material y desmolda cuando la pieza esté completamente firme.`,
      "Pigmentos": `${name} es un pigmento concentrado en polvo para colorear jabones y preparaciones artesanales compatibles. Debe dispersarse bien para evitar grumos; la intensidad y el tono final dependen de la base y de la cantidad utilizada.`,
      "Utensilios": `${name} es un utensilio de apoyo para medir, preparar o manipular ingredientes durante procesos artesanales. Límpialo antes y después de cada uso y verifica que sea adecuado para la temperatura y el material de tu fórmula.`,
      "Aceites": `${name} es un aceite de uso cosmético que aporta emoliencia y facilita la elaboración de bálsamos, aceites corporales, jabones y otras fórmulas compatibles. Incorpóralo según la proporción prevista y realiza una prueba de estabilidad.`,
      "Activos & Vitaminas": `${name} es un activo cosmético para complementar formulaciones de cuidado personal compatibles. Respeta la dosis recomendada, la fase de incorporación y las condiciones de temperatura y pH indicadas para la fórmula.`,
      "Aditivos Cosméticos": `${name} es un aditivo funcional para formulaciones cosméticas y de higiene personal. Su uso depende del objetivo de la receta, por lo que conviene comprobar dosis, compatibilidad, temperatura y pH antes de preparar el lote completo.`,
      "Aguas Florales": `${name} es un agua floral aromática para incorporar en la fase acuosa de tónicos, brumas, cremas y otras formulaciones compatibles. Mantén buenas prácticas de higiene y utiliza un sistema conservante adecuado cuando la preparación contenga agua.`,
      "Alcalinos Puros": `${name} es una materia prima alcalina para procesos de formulación que requieren medición precisa. Debe manipularse con protección adecuada, siguiendo una receta comprobada y evitando el contacto directo con piel y ojos.`,
      "Bases BioAlei": `${name} es una base cosmética preparada para personalizar con ingredientes compatibles. Añade activos, aromas o colorantes en cantidades controladas y realiza una prueba pequeña para comprobar textura, estabilidad y apariencia.`,
      "Ceras & Mantecas": `${name} es un ingrediente lipídico para aportar consistencia y emoliencia a bálsamos, cremas, jabones y otras fórmulas compatibles. Fúndelo suavemente cuando sea necesario y evita el calentamiento excesivo.`,
      "Conservadores": `${name} es un conservante para ayudar a proteger formulaciones cosméticas compatibles frente al deterioro microbiológico. Debe utilizarse dentro de su rango de dosis, temperatura y pH; no sustituye las buenas prácticas de higiene.`,
      "Envases & Utensilios": `${name} es un envase o accesorio para almacenar, dosificar o preparar productos cosméticos y artesanales. Verifica su capacidad y compatibilidad con la fórmula, y límpialo correctamente antes de llenarlo.`,
      "Espesantes & Emulsionantes": `${name} es un ingrediente funcional para ajustar la textura o favorecer la unión entre las fases de una formulación. El resultado depende de la dosis, el método de incorporación, la temperatura y el pH.`,
      "Extractos para Cosmética": `${name} es un extracto cosmético para complementar fórmulas de cuidado personal compatibles. Incorpóralo en la dosis adecuada y comprueba la compatibilidad con el resto de ingredientes, el pH y el sistema conservante.`,
      "Hierbas & Arcillas": mineralIngredient
        ? `${name} es una materia prima mineral para mascarillas, jabones y preparaciones artesanales compatibles. Dispersa la cantidad indicada y realiza una prueba previa; el color y la granulometría pueden variar entre lotes.`
        : `${name} es un ingrediente botánico para jabones, maceraciones y preparaciones artesanales compatibles. El color, aroma, tamaño de partícula y apariencia pueden variar naturalmente entre lotes.`,
      "Lufas": `${name} es una lufa de origen vegetal para exfoliación y elaboración de productos artesanales. Enjuágala antes del primer uso, deja que se seque completamente entre usos y reemplázala cuando presente desgaste.`,
      "Saborizantes": `${name} es un saborizante concentrado para formulaciones labiales u otras preparaciones expresamente compatibles. Utiliza una cantidad pequeña y confirma que todos los ingredientes de la receta sean adecuados para el uso previsto.`,
      "Tensoactivos": `${name} es un tensoactivo para aportar limpieza, espuma o capacidad de dispersión a fórmulas de higiene personal. La suavidad y el rendimiento dependen de la dosis, la combinación de ingredientes y el pH final.`,
      "Toallas Faciales": `${name} es un accesorio para rutinas de limpieza y cuidado facial. Lávalo antes del primer uso y mantenlo limpio y seco entre utilizaciones.`,
      "Aditivos Decorativos": `${name} es un elemento decorativo para velas y proyectos artesanales compatibles. Utilízalo de forma controlada y evita colocarlo donde pueda interferir con la mecha o la combustión.`,
      "Aditivos para Velas": `${name} es un aditivo para modificar el acabado, la dureza o el comportamiento de mezclas para velas. Realiza pruebas pequeñas, ya que el resultado depende de la cera, la fragancia, la mecha y la proporción utilizada.`,
      "Ceras": `${name} es una cera para elaborar velas y otras creaciones artesanales compatibles. Fúndela de forma gradual, controla la temperatura y realiza pruebas de combustión con la fragancia, el recipiente y la mecha seleccionados.`,
      "Fragancias": `${name} es una fragancia concentrada para perfumar velas y preparaciones artesanales compatibles. Añádela dentro del rango recomendado para la cera; la intensidad puede variar según la dosis, la base y el tiempo de curado.`,
      "Moldes para Velas": `${name} es un molde reutilizable para dar forma a velas artesanales. Asegura correctamente la mecha, vierte la mezcla a una temperatura adecuada y desmolda cuando la vela esté completamente firme.`,
      "Pabilos": `${name} es un pabilo para velas artesanales. El tamaño correcto depende del diámetro, la cera, la fragancia y el recipiente; realiza siempre una prueba de combustión antes de producir varias unidades.`,
      "Parafinas": `${name} es un material ceroso para elaborar velas y proyectos artesanales compatibles. Fúndelo con control de temperatura y prueba la combinación de mecha, fragancia, colorante y recipiente antes de preparar un lote.`,
      "Pigmentos para Velas": `${name} es un pigmento concentrado para colorear velas. Incorpóralo en pequeñas cantidades y mezcla hasta dispersarlo; el tono final puede variar según la cera y la dosis.`,
      "Portamechas & Portapabilos": `${name} es un accesorio para fijar o centrar la mecha durante la elaboración de velas. Comprueba que quede estable y alineado antes de verter la cera.`,
      "Utensilios para Velas": `${name} es un utensilio de apoyo para preparar, medir, decorar o mantener velas artesanales. Úsalo según su función y mantenlo limpio para evitar residuos en la mezcla.`
    };
    return descriptions[subcategory]
      || `${name} es un insumo para formulaciones cosméticas o proyectos artesanales compatibles. Revisa la presentación, utiliza cantidades controladas y realiza una prueba pequeña antes de preparar un lote completo.`;
  }

  window.LUMEA_PRODUCT_DESCRIPTION = descriptionFor;
  (window.LUMEA_CATALOG || []).forEach((product) => {
    product.description = descriptionFor(product);
  });
})();
