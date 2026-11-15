# Happy New Year — гацуур бүтээгч

Монгол хэлтэй, утсанд тохирсон шинэ жилийн жижиг урлан. Гацуураа чимэглээд, хувийн линк эсвэл PNG зураг болгон хуваалцаарай.

## Локал хөгжүүлэлт

```bash
npm ci
npm run dev
```

Шалгалт ба production build:

```bash
npm test -- --run
npm run build
```

## Хэрхэн тоглох вэ

- Чимэглэлээ товшоод модон дээр дарж байрлуулна, эсвэл палитраас мод руу чирж тавина.
- Байрлуулсан чимэглэлийг mouse эсвэл touch-оор чирж хөдөлгөнө.
- Keyboard ашиглахдаа гацуурын зураг дээр фокус аваад `Enter` дарж байрлуулна. Чимэглэл дээр `Enter` дарж сонгох, суман товчоор хөдөлгөх, `Delete`-ээр устгах боломжтой.
- **Хуваалцах** товч төхөөрөмжийн share цонхыг нээнэ; дэмжигдээгүй бол линкийг clipboard руу хуулна. **Линк хуулах** нь share цонх нээлгүйгээр URL-ийг шууд хуулна. Clipboard ажиллахгүй үед линкийг сонгон гараар хуулах талбар гарна.
- **PNG зураг татах** товч мод болон чимэглэлийг зураг болгон хадгална.
- Хуваалцсан мод URL-ийн fragment-д хувилбартайгаар хадгалагддаг. Backend шаардлагагүй. Буруу линк бол хоосон мод нээнэ.

## Vercel ба GitHub Actions

1. GitHub дээрх `enkush-3/happy-new-year` репозиторийг Vercel-д холбоно.
2. Vercel-ийн production branch-ийг `main` болгоно. Git холболт нь pull request/branch бүрт preview, `main` дээр production deploy гаргана.
3. Vercel-ийн **Deployment Checks** тохиргоонд **GitHub** provider сонгоод `CI / Tests and build` check-ийг production-д заавал шаардана. Ингэснээр check амжилттай болсны дараа л production домэйн шинэчлэгдэнэ.

`.github/workflows/ci.yml` нь pull request болон `main` push дээр lockfile-оос суулгаж, тест ба build ажиллуулна. Actions-д Vercel token хадгалах шаардлагагүй; deploy-ийг Vercel-ийн GitHub integration хийнэ.
