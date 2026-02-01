// js/strings.js
export const CLUB_DATA = {
  club: {
    id: "volcanes",
    shortName: "Volcanes",
    name: "Volcanes Ultimate",
    foundedYear: 2023
  },

  header: {
    logoText: "Volcanes",
    mobileTitle: "Volcanes Ultimate",
    cta: {
      label: "INGRESAR",
      action: "login"
    },
     menu: [
      { id: "home", label: "Home", href: "dashboard.html" },
      { id: "roster", label: "Roster", href: "roster.html" },
      { id: "trainings", label: "Entrenamientos", href: "trainings.html" },
      { id: "attendance", label: "Asistencia", href: "attendance.html" },
      { id: "tournaments", label: "Torneos", href: "dashboard.html#tournaments" },
      { id: "stats", label: "Estadísticas", href: "stats2024.html" }
    ],
     logout: {
      label: "Salir"
    }
  },

  landing: {
    hero: {
      title: "Más que un equipo, una comunidad",
      image: "img/volcanes/nicaragua.jpeg",
      description:
        "La misión del club es fortalecer la comunidad y promover el conocimiento y la práctica del deporte bajo el correcto espíritu de juego. Queremos crear espacios donde se practique de manera saludable el Ultimate.",
      cta: "Ver entrenamientos"
    },

    events: [
      {
        id: "cartaglow",
        name: "Cartaglow",
        edition: 2025,
        type: "hat-mixto",
        format: "un-dia",
        participants: 82,
        nextEdition: {
          month: "Agosto",
          year: 2026
        },
        description:
          "Torneo tipo hat mixto, de un solo día, enfocado en comunidad y espíritu de juego.",
        images: [
          "img/cartaglow/cartaglow00.jpg",
          "img/cartaglow/cartaglow01.jpg",
          "img/cartaglow/cartaglow02.jpg"
        ]
      }
    ],

    trainings: {
      title: "Entrenamientos y Juegos",
      blocks: [
        {
          id: "trainings",
          name: "Entrenamientos",
          schedule: [
            { day: "Domingos", time: "8:00 am – 10:30 am" },
            { day: "Miércoles", time: "7:00 pm – 9:30 pm" }
          ]
        },
        {
          id: "games",
          name: "Juegos y Torneos",
          schedule: [{ day: "Martes", time: "8:00 pm – 10:00 pm" }]
        }
      ]
    },

    honors: {
      title: "Palmarés",
      items: [
        {
          position: "Primer Lugar",
          tournament: "Copa Invierno",
          year: 2025
        },
        {
          position: "Tercer Lugar",
          tournament: "Copa Verano",
          year: 2025
        },
        {
          position: "Primer Lugar",
          tournament: "Espíritu Chorotega",
          year: 2025
        },
        {
          position: "Espíritu de Juego",
          tournament: "Copa Invierno",
          year: 2024
        }
      ]
    },

    uniforms: {
      title: "Uniformes del Equipo",
      subtitle: "Compra tu indumentaria oficial del club",
      orderUrl:
        "https://docs.google.com/forms/d/e/1FAIpQLScWsh7S91GY6MZ_1ewNu1Eth7L0IK9ycHwbySY5THZe3vM2mg/viewform",
      items: [
        {
          id: "jersey-home",
          name: "Camisa Oficial",
          category: "camisa",
          image: "img/camisas/chalecos.jpg"
        },
        {
          id: "jersey-away",
          name: "Camisa Alternativa",
          category: "camisa",
          image: "img/camisas/white.jpg"
        },
        {
          id: "vest",
          name: "Chaleco",
          category: "chaleco",
          image: "img/camisas/chaleco.jpg"
        },
        {
          id: "hoodie",
          name: "Hoodie",
          category: "abrigo",
          image: "img/camisas/hoodie.jpg"
        },
        {
          id: "shorts",
          name: "Pantaloneta",
          category: "pantaloneta",
          image: "img/camisas/shorts.jpg"
        },
        {
          id: "cap",
          name: "Gorra",
          category: "accesorio",
          image: "img/camisas/cap.jpg"
        }
      ]
    }
  },

  footer: {
    copyright: "© Volcanes Ultimate"
  }
};
