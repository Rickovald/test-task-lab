use std::fs::OpenOptions;
use std::io::Write;
use rand::Rng;

const BASE64_CHARS: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn determine_bits_per_number(numbers: &[u16]) -> u8 {
    let max = *numbers.iter().max().unwrap();
    if max < 10 {
        4
    } else if max < 100 {
        7
    } else {
        9
    }
}

fn serialize(numbers: &[u16]) -> String {
    if numbers.iter().any(|&n| n < 1 || n > 300) {
        panic!("Все числа должны быть в диапазоне 1-300");
    }

    let bits_per_number = determine_bits_per_number(numbers);
    let bits_code = match bits_per_number {
        4 => "00",
        7 => "01",
        9 => "10",
        _ => panic!("Unsupported bits per number"),
    };

    let mut bitstr = String::new();

    if numbers.len() < 64 {
        bitstr.push('0');
        bitstr += &format!("{:06b}", numbers.len());
    } else {
        bitstr.push('1');
        bitstr += &format!("{:010b}", numbers.len());
    }

    bitstr += bits_code;

    for &num in numbers {
        bitstr += &format!("{:0width$b}", num, width = bits_per_number as usize);
    }

    let padding = (6 - (bitstr.len() % 6)) % 6;
    bitstr += &"0".repeat(padding);

    let mut result = String::new();
    for chunk in bitstr.as_bytes().chunks(6) {
        let chunk_str = std::str::from_utf8(chunk).unwrap();
        let val = u8::from_str_radix(chunk_str, 2).unwrap();
        result.push(BASE64_CHARS[val as usize] as char);
    }

    result
}

fn deserialize(s: &str) -> Vec<u16> {
    let mut bitstr = String::new();
    for ch in s.chars() {
        let index = BASE64_CHARS
            .iter()
            .position(|&c| c == ch as u8)
            .expect("Invalid base64 char");
        bitstr += &format!("{:06b}", index);
    }

    let mut pos = 0;
    let flag = &bitstr[pos..pos + 1];
    pos += 1;

    let count: usize = if flag == "0" {
        let len = usize::from_str_radix(&bitstr[pos..pos + 6], 2).unwrap();
        pos += 6;
        len
    } else {
        let len = usize::from_str_radix(&bitstr[pos..pos + 10], 2).unwrap();
        pos += 10;
        len
    };

    let bits_code = &bitstr[pos..pos + 2];
    pos += 2;

    let bits_per_number = match bits_code {
        "00" => 4,
        "01" => 7,
        "10" => 9,
        _ => panic!("Invalid bits code"),
    };

    let mut numbers = Vec::new();
    for _ in 0..count {
        let chunk = &bitstr[pos..pos + bits_per_number];
        let num = u16::from_str_radix(chunk, 2).unwrap();
        numbers.push(num);
        pos += bits_per_number;
    }

    numbers
}

fn compression_ratio(numbers: &[u16]) -> f64 {
    let trivial = numbers.iter().map(|n| n.to_string()).collect::<Vec<_>>().join(",");
    let serialized = serialize(numbers);
    serialized.len() as f64 / trivial.len() as f64
}

fn log(message: &str) {
    println!("{}", message);
    let mut file = OpenOptions::new()
        .append(true)
        .create(true)
        .open("output.txt")
        .unwrap();
    writeln!(file, "{}", message).unwrap();
}

fn run_tests() {
    let mut rng = rand::rng();

    let tests: Vec<(&str, Vec<u16>)> = vec![
        ("Простейший короткий 1", vec![1, 2, 3]),
        ("Простейший короткий 2", vec![1, 2, 3, 4, 5, 6, 7, 8, 9]),
        (
            "Случайные 50 чисел",
            (0..50).map(|_| rng.random_range(1..=300)).collect(),
        ),
        (
            "Случайные 100 чисел",
            (0..100).map(|_| rng.random_range(1..=300)).collect(),
        ),
        (
            "Случайные 500 чисел",
            (0..500).map(|_| rng.random_range(1..=300)).collect(),
        ),
        (
            "Случайные 1000 чисел",
            (0..1000).map(|_| rng.random_range(1..=300)).collect(),
        ),
        (
            "Граничный: все 1-значные (1..9)",
            (0..300).map(|i| (i % 9 + 1) as u16).collect(),
        ),
        (
            "Граничный: все 2-значные (10..99)",
            (0..300).map(|i| (10 + (i % 90)) as u16).collect(),
        ),
        (
            "Граничный: все 3-значные (100..300)",
            (0..300).map(|i| (100 + (i % 201)) as u16).collect(),
        ),
        (
            "Граничный: каждого числа по 3 раза (от 1 до 300, итого 900 чисел)",
            (1..=300).flat_map(|n| vec![n; 3]).collect(),
        ),
    ];

    for (desc, data) in tests {
        let trivial = data.iter().map(|n| n.to_string()).collect::<Vec<_>>().join(",");
        let serialized = serialize(&data);
        let deserialized = deserialize(&serialized);
        let ratio = compression_ratio(&data);

        log(&format!("Тест: {}", desc));
        log(&format!("Исходная строка (trivial): {}{}", 
            &trivial.chars().take(60).collect::<String>(), 
            if trivial.len() > 60 { "..." } else { "" }
        ));
        log(&format!("Сериализованная строка: {}", serialized));
        log(&format!("Коэффициент сжатия: {:.3}", ratio));
        log(&format!("Десериализованный массив корректен? {}", if deserialized == data { "Да" } else { "Нет" }));
        log("------------------------------------------------------");
    }
}

fn main() {
    run_tests();
}
