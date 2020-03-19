'use strict';
const width = window.innerWidth,
    height = window.innerHeight,
    maxRadius = Math.min(width, height) / 2 - 5;

const svg = d3
    .select('body')
    .append('svg')
    .style('width', '100vw')
    .style('height', '100vh')
    .attr('viewBox', `${-width / 50} ${-height / 50} ${width} ${height}`)
    .append('g').attr("transform","translate("+width/100+","+height/100+")")
svg.append('text')
    .attr('class', 'title')
    .attr('x', width/2).attr('y', 20).text("2019-nCoV 全国疫情可视化系统");

d3.json('farmers-markets-lat-long.json', function (error, data) {
    var h = 480;
    var w = 800;
    var padding = 20;
    var xScale = d3.scaleLinear().range([padding, w - padding]).domain([-130, -65]);//经纬度，用于中间原点的映射
    var xBarScale = d3.scaleLinear().range([padding, w - padding]);
    var yScale = d3.scaleLinear().range([h - padding, padding]).domain([20, 50]);
    var comp1 = "maple";
    var comp2 = "seafood";
    var selected = 'comp1';
    var offset = 'translate(60, 40)';

    //为了简单起见，过滤掉相邻US之外的状态
    //想法：我们可以对拿到的数据根据某些属性进行过滤，比如根据点击的城市，只接受名字为某某的那一个
    data = data.filter(function (d) {
        return d.x >= -130 && d.x <= -65 && d.y >= 20 && d.y <= 50;
    });

    //Making a legend w00t http://d3-legend.susielu.com/
    var colors = d3.scaleOrdinal().domain(['' + comp1, '' + comp2, 'both']).range(["rgba(0, 200, 200, .5)", "rgba(200, 0, 200, .5)", "#ac8cdc"]);

    var colorLegend = d3.legendColor().shapeHeight(8).shapePadding(5).scale(colors);

    svg.append('g').attr('class', 'legend').attr('transform', 'translate(840, 450)').call(colorLegend);
    //--------已创建好了图表----

    //-----------把圆形图移植过来 Start----
    var map = svg.append('g').attr('class', 'map').attr('transform', 'translate('+width/2+","+height/2+")scale(0.8)");

    const formatNumber = d3.format(',d');

    const x = d3.scaleLinear()
        .range([0, 2 * Math.PI])
        .clamp(true);

    const y = d3.scaleSqrt().range([maxRadius * 0.1, maxRadius]);

// sunlight style guide network colors
// https://github.com/amycesal/dataviz-style-guide/blob/master/Sunlight-StyleGuide-DataViz.pdf
    const dark = [
        '#B08B12',
        '#BA5F06',
        '#8C3B00',
        '#6D191B',
        '#842854',
        '#5F7186',
        '#193556',
        '#137B80',
        '#144847',
        '#254E00'
    ];

    const mid = [
        '#E3BA22',
        '#E58429',
        '#BD2D28',
        '#D15A86',
        '#8E6C8A',
        '#6B99A1',
        '#42A5B3',
        '#0F8C79',
        '#6BBBA1',
        '#5C8100'
    ];

    const light = [
        '#F2DA57',
        '#F6B656',
        '#E25A42',
        '#DCBDCF',
        '#B396AD',
        '#B0CBDB',
        '#33B6D0',
        '#7ABFCC',
        '#C8D7A1',
        '#A0B700'
    ];

    const palettes = [light, mid, dark];
    const lightGreenFirstPalette = palettes
        .map(d => d.reverse())
        .reduce((a, b) => a.concat(b));

//颜色生成器
    const color = d3.scaleOrdinal(lightGreenFirstPalette);

    const color2 = d3.scalePow()
        .exponent(1)
        .domain([0,4000])
        .range(["#6eeb34","#eb3434","#eb9934","#eb3434"]);

//为了后面把层次数据递归的生成旭日图或饼状图
    const partition = d3.partition();

// 定义一个弧生成器
    /*
        x0:圆环开始角度
        x1:圆环结束角度
        y0:圆环内半径
        y1:圆环外半径
     */
    const arc = d3
        .arc()
        .startAngle(d => x(d.x0))
        .endAngle(d => x(d.x1))
        .innerRadius(d => Math.max(0, y(d.y0)))
        .outerRadius(d => Math.max(0, y(d.y1)));

    const middleArcLine = d => {
        const halfPi = Math.PI / 2;
        const angles = [x(d.x0) - halfPi, x(d.x1) - halfPi];
        const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);

        const middleAngle = (angles[1] + angles[0]) / 2;
        const invertDirection = middleAngle > 0 && middleAngle < Math.PI; // On lower quadrants write text ccw
        if (invertDirection) {
            angles.reverse();
        }

        const path = d3.path();
        path.arc(0, 0, r, angles[0], angles[1], invertDirection);
        return path.toString();
    };

    const textFits = d => {
        const CHAR_SPACE = 6;

        const deltaAngle = x(d.x1) - x(d.x0);
        const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);
        const perimeter = r * deltaAngle;

        return d.data.name.length * CHAR_SPACE < perimeter;
    };


    d3.json(
        'flare.json',
        (error, root) => {
            if (error) throw error;
            // console.log(root)

            root = d3.hierarchy(root); //从分层数据构造一个根节点，方便下面布局函数调用
            // console.log(root)
            root.sum(d => d.size);  //依次生成所有后代节点的数组

            const slice = map.selectAll('g.slice').data(partition(root).descendants()); //生成后代数组然后绑定到属性为slice的g上
            // console.log(partition(root).descendants()) // 因为绑定就是绑定的这个，所有传递的也是这个

            slice.exit().remove(); //清除工作

            const newSlice = slice
                .enter()
                .append('g')
                .attr('class', 'slice')
                .on('click', d => {
                    d3.event.stopPropagation();//阻止点击事件的传播
                    focusOn(d); //每一块都执行这个事件
                });

            newSlice
                .append('title')
                .text(d => d.data.name + '\n' + formatNumber(d.value)+'\n'); //鼠标悬停在上面时，显示的文字

            newSlice
                .append('path')
                .attr('class', 'main-arc')
                // .style('fill', d => color((d.children ? d.data.name : day_color(d)))) //每一块的颜色，我们最后一层的颜色，是随着时间的变化，随着值的不同，而不同的
                .style("fill",d => d.children?color(d.data.name):color2(d.value))
                .attr('d', arc);

            function day_color(d){
                //根据每个d值的不同而呈现不一样的颜色，做一个颜色变化范围的插值器就行了
                var value = d.value,
                    tag = "";
                if(value<1000)
                    tag =  "china";
                else if(value > 1000 && value < 3000)
                    tag = "wuhan";
                else
                    tag = "ll";
                return tag;
            }

            newSlice
                .append('path') //跟下面那个结合绘制文字
                .attr('class', 'hidden-arc')
                .attr('id', (_, i) => `hiddenArc${i}`)
                .attr('d', middleArcLine);

            const text = newSlice
                .append('text') //写入文字
                .attr('display', d => (textFits(d) ? null : 'none'));

            // 为文字增加白色轮廓
            text
                .append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', (_, i) => `#hiddenArc${i}`) //
                .text(d => d.data.name)
                .style('fill', 'none')
                .style('stroke', '#E5E2E0')
                .style('stroke-width', 12)
                .style('stroke-linejoin', 'round');

            text
                .append('textPath')
                .attr('startOffset', '50%')
                .attr('xlink:href', (_, i) => `#hiddenArc${i}`)
                .text(d => d.data.name);
        }
    );

    function focusOn(d) {
        // 如果未指定数据点，则重置为顶级

        const transition = map
            .transition()
            .duration(750)
            .tween('scale', () => {
                const xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
                    yd = d3.interpolate(y.domain(), [d.y0, 1]);
                return t => {
                    x.domain(xd(t));
                    y.domain(yd(t));
                };
            });

        transition.selectAll('path.main-arc').attrTween('d', d => () => arc(d));

        transition
            .selectAll('path.hidden-arc')
            .attrTween('d', d => () => middleArcLine(d));

        transition
            .selectAll('text')
            .attrTween('display', d => () => (textFits(d) ? null : 'none'));

        moveStackToFront(d);

        //指定外围圆圈
        /*if(d.depth == 2){
            var circle = map.append("g")
                .attr("id",'circle')
                .append("circle")
                .attr("r",maxRadius)
                .attr("fill","none")
                .attr("stroke","black")
                .attr("stroke-width",2)
        }else
            d3.select('#circle').remove();*/

        //移动到前面显示的方法
        function moveStackToFront(elD) {
            map
                .selectAll('.slice')
                .filter(d => d === elD)
                .each(function(d) {
                    this.parentNode.appendChild(this);
                    if (d.parent) {
                        moveStackToFront(d.parent);
                    }
                });
        }
    }

    //----------End---------------------


    //---------------Bar 生成器、线性尺度 Start准备工作----------

    var rollup = function rollup(leaves) {
        var first = 0;
        var second = 0;
        var both = 0;

        leaves.forEach(function (l) {
            if (l[comp1] === "Y") {
                first++;
            }
            if (l[comp2] === "Y") {
                second++;
            }
            if (l[comp1] === "Y" && l[comp2] === "Y") {
                both++;
            }
        });

        return {
            length: leaves.length,
            comp1: first,
            comp2: second,
            both: both
        };
    };
    var long = svg.append('g').attr('class', 'long')
        // .attr("transform","translate("+width/5+","+height/20+")")
        .attr('transform', 'rotate(90, ' + (3*width/4) + ','+ (50)+ ')scale(1.2)');
    // var long = svg.append('g').attr('class', 'long').attr('transform', 'translate('+width/2+","+height/20+")rotate(90,360,200)");

    var xLongScale = d3.scaleLinear().range([w + padding, w + h - padding]).domain([50, 20]);

    //后面调用这个生成器
    var longArea = d3.area().x(function (d) {
            return xLongScale(parseInt(d.key));
        }).y1(function (d) {
            return yLongScale(d.value.length);
        }).y0(function (d) {
            return yLongScale(0);
        }).curve(d3.curveCardinal),

        //构建数据，方便下面两行构建比例尺
        longNested = d3.nest().key(function (d) {
            return Math.round(d.y);
        }).rollup(rollup).entries(data).sort(function (a, b) {
            return parseInt(a.key) - parseInt(b.key);
        });

    var yLongMax = d3.max(longNested, function (d) {
        return d.value.length;
    });
    var yLongScale = d3.scaleLinear().range([padding, padding - 100]).domain([0, yLongMax]);

    //定义d3的缓动函数
    var transition = d3.transition().ease(d3.easePolyInOut);

    //---------------Bar 生成器、线性尺度 end准备工作----------

    //先生成咱们静态的部分
    var createHistogram = function createHistogram(group, area, nest) {
        group.append('path').attr('fill', 'none').attr('stroke', 'grey').attr('d', area(nest));

        group.append('path').attr('class', 'comp1');

        group.append('path').attr('class', 'comp2');
    };

    var updateHistogram = function updateHistogram(type, group, area, nest, scale) {
        var nestKey = type === "lat" ? 'x' : 'y';
        //构造一个数据结构
        nest = d3.nest().key(function (d) {
            return Math.round(d[nestKey]);
        }).rollup(rollup).entries(data).sort(function (a, b) {
            return parseInt(a.key) - parseInt(b.key);
        });

        //Overlapping bump area logic
        area.y1(function (d) {
            if (d.value.comp1 > d.value.comp2) {
                return scale(d.value.comp1);
            } else {
                return scale(d.value.comp1 + d.value.comp2 - d.value.both);
            }
        });

        area.y0(function (d) {
            if (d.value.comp1 > d.value.comp2) {
                return scale(0);
            } else {
                return scale(d.value.comp2 - d.value.both);
            }
        });

        group.select('path.comp1').transition(transition).attr('d', area(nest));

        //Overlapping bump area logic
        area.y1(function (d) {
            if (d.value.comp2 > d.value.comp1) {
                return scale(d.value.comp2);
            } else {
                return scale(d.value.comp1 + d.value.comp2 - d.value.both);
            }
        });

        area.y0(function (d) {
            if (d.value.comp2 > d.value.comp1) {
                return scale(0);
            } else {
                return scale(d.value.comp1 - d.value.both);
            }
        });

        group.select('path.comp2').transition(transition).attr('d', area(nest));
    };

    var update = function update() {
        updateHistogram('long', long, longArea, longNested, yLongScale);

        //Update text colors in Goods selector
        svg.selectAll('.types text').attr('class', function (d) {
            return d.key === comp1 ? 'comp1' : d.key === comp2 ? 'comp2' : '';
        });

        //Update legend key
        colors.domain(['' + comp1, '' + comp2, 'both']);
        colorLegend.scale(colors);
        svg.select('g.legend').call(colorLegend);
    };

    //Initial render of graphs and map
    createHistogram(long, longArea, longNested);
    update();

    //----------左侧文字的所有功能 start ---------
    var variables = [{ "key": "vegetables", "label": "武汉 96%", "percent": .96 }, { "key": "bakedgoods", "label": "宣城 88%", "percent": .88 }, { "key": "honey", "label": "成都 81%", "percent": .81 }, { "key": "jams", "label": "大兴 80%", "percent": .80 }, { "key": "fruits", "label": "深圳 80%", "percent": .80 }, { "key": "herbs", "label": "牡丹江 79%", "percent": .79 }, { "key": "eggs", "label": "黄冈 74%", "percent": .74 }, { "key": "flower", "label": "香港 69%", "percent": .69 }, { "key": "soap", "label": "杭州 67%", "percent": .67 }, { "key": "plants", "label": "台州 66%", "percent": .66 }, { "key": "crafts", "label": "温州 61%", "percent": .61 }, { "key": "prepared", "label": "舟山 61%", "percent": .61 }, { "key": "meat", "label": "Meat 55%", "percent": .55 }, { "key": "cheese", "label": "Cheese 50%", "percent": .50 }, { "key": "poultry", "label": "Poultry 45%", "percent": .45 }, { "key": "coffee", "label": "Coffee 33%", "percent": .33 }, { "key": "maple", "label": "Maple 32%", "percent": .32 }, { "key": "nuts", "label": "Nuts 29%", "percent": .29 }, { "key": "trees", "label": "Trees 29%", "percent": .29 }, { "key": "seafood", "label": "Seafood 24%", "percent": .24 }, { "key": "juices", "label": "Juices 22%", "percent": .22 }, { "key": "mushrooms", "label": "Mushrooms 22%", "percent": .22 }, { "key": "petfood", "label": "Pet Food 18%", "percent": .18 }, { "key": "wine", "label": "Wine 17%", "percent": .17 }, { "key": "beans", "label": "Beans 14%", "percent": .14 }, { "key": "grains", "label": "Grains 14%", "percent": .14 }, { "key": "wildharvest", "label": "Wild Harvest 13%", "percent": .13 }, { "key": "nursery", "label": "Nursery 6%", "percent": .06 }, { "key": "tofu", "label": "Tofu 4%", "percent": .04 }];

    svg.append('text').attr('class', '.controlTitle')
        .attr("transform","translate("+width/10+","+height/20+")")
        .attr('x', 20).attr('y', 40).text('累计确诊人数排名');

    svg.selectAll('rect.control').data(['comp1', 'comp2']).enter().append('rect')
        .attr("transform","translate("+width/10+","+height/16+")")
        .attr('x', function (d, i) {
        return 20 + i * 20;
    }).attr('y', 50).attr('width', 15).attr('height', 15).attr('class', function (d) {
        return 'control ' + d + ' ' + (selected === d ? 'selected' : '');
    }).on('click', function (d) {
        if (selected === "comp1") {
            selected = "comp2";
        } else {
            selected = "comp1";
        }

        svg.selectAll('rect.control').attr('class', function (d) {
            return 'control ' + d + ' ' + (selected === d ? 'selected' : '');
        });
    });

    var types = svg.append('g').attr('class', 'types');

    var changeComp = function changeComp(d) {
        if (selected === "comp1") {
            //就是里面的文字“honey”这些
            comp1 = d.key;
        } else {
            comp2 = d.key;
        }
        update();
    };

    types.selectAll('text').data(variables).enter().append('text')
        .attr("transform","translate("+width/10+","+height/14+")")
        .attr('x', 20).attr('y', function (d, i) {
        return i * 14 + 80;
    }).text(function (d) {
        return d.label;
    }).attr('class', function (d) {
        return d.key === comp1 ? 'comp1' : d.key === comp2 ? 'comp2' : '';
    }).on('click', changeComp);

    //----------左侧文字的所有功能 end ---------
});




