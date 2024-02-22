
const t = require("tap")

const scraper = require("../dist").GoogleFormsScraper();

t.test('this is a child test', t => {
    //Arrange
    const input = { url: "https://docs.google.com/forms/d/e/1FAIpQLSe-WZhPGbnn_7oYig2iWHacflIDz8OBIhMHU3cmed3PaGCC9w/viewform" }
    //Act
    scraper.getFormTemplate(input)
        //Assert
        .then(response => {
            return t.match(response.title, "Prueba Guesthub")
        }).then(() => {
            t.end()
        })
})

