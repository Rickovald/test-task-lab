import * as fs from 'fs';
import * as path from 'path';

const logFilePath = path.join(__dirname, 'output.txt');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' }); // 'a' - добавлять в конец файла

// Перенаправляем console.log в файл
const log = (message: string) => {
    console.log(message);
    logStream.write(message + '\n');
};



interface Test { description: string; data: number[]; }
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Определяет, сколько бит нужно для кодирования чисел,
 * исходя из максимального значения в массиве.
 *  - max < 10   => 4 бита,
 *  - max < 100  => 7 бит,
 *  - иначе      => 9 бит.
 */
function determineBitsPerNumber(numbers: number[]): number {
    const max = Math.max(...numbers);
    if (max < 10) return 4;
    if (max < 100) return 7;
    return 9;
}

/**
 * Сериализация массива чисел (1–300) в компактную строку с динамическим выбором бит на число.
 * Заголовок состоит из:
 * - 1 бит: флаг для длины (0 – длина в 6 бит, если count < 64; 1 – длина в 10 бит),
 * - далее 6 или 10 бит: количество чисел,
 * - 2 бит: код, задающий количество бит для кодирования чисел:
 *     00 – 4 бита, 01 – 7 бит, 10 – 9 бит.
 * @param numbers Массив чисел.
 * @returns Сериализованная строка.
 */
function serialize(numbers: number[]): string {
    if (numbers.some(num => num < 1 || num > 300)) {
        throw new Error("Все числа должны быть в диапазоне 1-300");
    }

    let bitStr = "";

    // Определяем сколько бит нужно для чисел
    const bitsPerNumber = determineBitsPerNumber(numbers);

    // Кодируем битовую метку для bitsPerNumber (2 бита):
    // 00 – 4 бита, 01 – 7 бит, 10 – 9 бит
    let bitsCode: string;
    if (bitsPerNumber === 4) bitsCode = "00";
    else if (bitsPerNumber === 7) bitsCode = "01";
    else if (bitsPerNumber === 9) bitsCode = "10";
    else throw new Error("Неподдерживаемое количество бит для числа");

    // Кодируем длину массива: если numbers.length < 64, используем 7 бит (1 бит флага + 6 бит)
    // иначе – 11 бит (1 бит флага + 10 бит)
    if (numbers.length < 64) {
        bitStr += "0" + numbers.length.toString(2).padStart(6, "0");
    } else {
        bitStr += "1" + numbers.length.toString(2).padStart(10, "0");
    }
    // Добавляем 2 бита для bitsPerNumber
    bitStr += bitsCode;

    // Кодируем каждое число, используя выбранное число бит
    for (const num of numbers) {
        bitStr += num.toString(2).padStart(bitsPerNumber, "0");
    }

    // Дополняем строку нулями, чтобы длина была кратна 6
    const padding = (6 - (bitStr.length % 6)) % 6;
    bitStr = bitStr.padEnd(bitStr.length + padding, "0");

    // Преобразуем каждую группу по 6 бит в символ Base64
    let result = "";
    for (let i = 0; i < bitStr.length; i += 6) {
        const chunk = bitStr.substr(i, 6);
        const index = parseInt(chunk, 2);
        result += BASE64_CHARS[index];
    }
    return result;
}

/**
 * Десериализация строки обратно в массив чисел.
 * @param serialized Сериализованная строка.
 * @returns Массив чисел.
 */
function deserialize(serialized: string): number[] {
    let bitStr = "";
    for (const ch of serialized) {
        const index = BASE64_CHARS.indexOf(ch);
        if (index === -1) throw new Error(`Неверный символ в строке: ${ch}`);
        bitStr += index.toString(2).padStart(6, "0");
    }

    let pos = 0;
    // Читаем флаг для длины
    const flag = bitStr[pos++];
    let count: number;
    if (flag === "0") {
        count = parseInt(bitStr.substr(pos, 6), 2);
        pos += 6;
    } else {
        count = parseInt(bitStr.substr(pos, 10), 2);
        pos += 10;
    }
    // Читаем 2 бита – код для bitsPerNumber
    const bitsCode = bitStr.substr(pos, 2);
    pos += 2;
    let bitsPerNumber: number;
    if (bitsCode === "00") bitsPerNumber = 4;
    else if (bitsCode === "01") bitsPerNumber = 7;
    else if (bitsCode === "10") bitsPerNumber = 9;
    else throw new Error("Неверный код битовой длины");

    const numbers: number[] = [];
    for (let i = 0; i < count; i++) {
        const chunk = bitStr.substr(pos, bitsPerNumber);
        const num = parseInt(chunk, 2);
        numbers.push(num);
        pos += bitsPerNumber;
    }
    return numbers;
}

/**
 * Вычисление коэффициента сжатия:
 * отношение длины сериализованной строки к длине тривиальной сериализации (числа через запятую).
 */
function compressionRatio(numbers: number[]): number {
    const trivial = numbers.join(",");
    const serialized = serialize(numbers);
    return serialized.length / trivial.length;
}

/**
 * Тестирование на различных наборах данных.
 */
function runTests() {
    const tests: Test[] = [
        { description: "Простейший короткий 1", data: [1, 2, 3] },
        { description: "Простейший короткий 2", data: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
        {
            description: "Случайные 50 чисел",
            data: Array.from({ length: 50 }, () => Math.floor(Math.random() * 300) + 1)
        },
        {
            description: "Случайные 100 чисел",
            data: Array.from({ length: 100 }, () => Math.floor(Math.random() * 300) + 1)
        },
        {
            description: "Случайные 500 чисел",
            data: Array.from({ length: 500 }, () => Math.floor(Math.random() * 300) + 1)
        },
        {
            description: "Случайные 1000 чисел",
            data: Array.from({ length: 1000 }, () => Math.floor(Math.random() * 300) + 1)
        },
        {
            description: "Граничный: все 1-значные (1..9)",
            data: Array.from({ length: 300 }, (_, i) => (i % 9) + 1)
        },
        {
            description: "Граничный: все 2-значные (10..99)",
            data: Array.from({ length: 300 }, (_, i) => 10 + (i % 90))
        },
        {
            description: "Граничный: все 3-значные (100..300)",
            data: Array.from({ length: 300 }, (_, i) => 100 + (i % 201))
        },
        {
            description: "Граничный: каждого числа по 3 раза (от 1 до 300, итого 900 чисел)",
            data: (() => {
                const arr: number[] = [];
                for (let i = 1; i <= 300; i++) {
                    arr.push(i, i, i);
                }
                return arr;
            })()
        },
    ];

    for (const test of tests) {
        const trivial = test.data.join(",");
        const serialized = serialize(test.data);
        const ratio = compressionRatio(test.data);
        const deserialized = deserialize(serialized);
        log(`Тест: ${test.description}`);
        log(`Исходная строка (trivial): ${trivial.slice(0, 60) + (trivial.length > 60 ? "..." : "")}`);
        log(`Сериализованная строка: ${serialized}`);
        log(`Коэффициент сжатия: ${ratio.toFixed(3)}`,);
        log(`Десериализованный массив корректен? ${deserialized ? 'Да' : 'Нет'}`);
        log("------------------------------------------------------");
    }
}

// Запускаем тесты
runTests();
logStream.end(); 
